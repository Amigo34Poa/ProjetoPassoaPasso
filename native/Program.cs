using System.Diagnostics;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Speech.Recognition;
using System.Text;
using System.Text.Json;

internal static class Program
{
    static readonly object OutputLock = new();
    static readonly Stopwatch Clock = new();
    static volatile bool active, paused, shuttingDown;
    static int displayIndex, busy;
    static double pauseStart, pausedMs;
    static IntPtr mouseHook;
    static HookProc? mouseProc;
    static SpeechRecognitionEngine? speech;
    static CaptureWindow? window;
    static ClickOverlay? overlay;
    static IntPtr controlHandle;
    static readonly System.Threading.Timer Timer = new(_ => Frame(), null, Timeout.Infinite, Timeout.Infinite);
    sealed record FrameSnapshot(string Image, long Ticks);
    static FrameSnapshot? latestFrame;

    [STAThread]
    static void Main(string[] args)
    {
        if (!args.Contains("--capture")) { Launcher.Run(); return; }
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        window = new CaptureWindow();
        controlHandle = window.Handle;
        overlay = new ClickOverlay();
        TargetProbe.Start(() => active && !paused);
        var hotkeys = new Dictionary<string, bool> {
            ["toggle"] = RegisterHotKey(window.Handle, 1, 0x4000 | 0x0002 | 0x0001, (uint)Keys.R),
            ["mark"] = RegisterHotKey(window.Handle, 2, 0x4000 | 0x0002 | 0x0001, (uint)Keys.M),
            ["pause"] = RegisterHotKey(window.Handle, 3, 0x4000 | 0x0002 | 0x0001, (uint)Keys.P),
        };
        mouseProc = MouseCallback;
        mouseHook = SetWindowsHookEx(14, mouseProc, GetModuleHandle(null), 0);
        var displays = Screen.AllScreens.Select((s, i) => new { id = i, name = s.DeviceName, primary = s.Primary, x = s.Bounds.X, y = s.Bounds.Y, width = s.Bounds.Width, height = s.Bounds.Height }).ToArray();
        string[] languages;
        try { languages = SpeechRecognitionEngine.InstalledRecognizers().Select(r => r.Culture.Name).Distinct().ToArray(); }
        catch { languages = []; }
        Emit(new { type = "ready", displays, speechLanguages = languages, hotkeys, mouseHook = mouseHook != IntPtr.Zero });
        _ = Task.Run(ReadCommands);
        Application.Run(window);
        Shutdown();
    }

    static void ReadCommands()
    {
        try {
            string? line;
            while ((line = Console.ReadLine()) != null && !shuttingDown) {
                using var doc = JsonDocument.Parse(line);
                var root = doc.RootElement;
                var type = root.GetProperty("type").GetString();
                if (type == "start") {
                    displayIndex = Math.Clamp(root.GetProperty("display").GetInt32(), 0, Screen.AllScreens.Length - 1);
                    Volatile.Write(ref latestFrame, null);
                    pausedMs = 0; paused = false; Clock.Restart(); active = true;
                    Timer.Change(0, 250);
                    if (root.TryGetProperty("speech", out var useSpeech) && useSpeech.GetBoolean()) window?.BeginInvoke(() => StartSpeech());
                }
                if (type == "pause") {
                    var next = root.GetProperty("paused").GetBoolean();
                    if (next && !paused) pauseStart = Clock.Elapsed.TotalMilliseconds;
                    if (!next && paused) pausedMs += Clock.Elapsed.TotalMilliseconds - pauseStart;
                    paused = next;
                }
                if (type == "stop") {
                    active = false; Timer.Change(Timeout.Infinite, Timeout.Infinite);
                    window?.BeginInvoke(() => StopSpeech());
                }
                if (type == "shutdown") break;
            }
        } catch { Emit(new { type = "error", message = "O canal de captura Windows foi interrompido." }); }
        window?.BeginInvoke(() => window.Close());
    }

    static double Time() => Math.Max(0, (Clock.Elapsed.TotalMilliseconds - pausedMs - (paused ? Clock.Elapsed.TotalMilliseconds - pauseStart : 0)) / 1000);

    static void Frame()
    {
        if (!active || paused || Interlocked.Exchange(ref busy, 1) != 0) return;
        try {
            var bounds = Screen.AllScreens[displayIndex].Bounds;
            using var bitmap = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bitmap)) {
                g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size, CopyPixelOperation.SourceCopy);
                var ci = new CursorInfo { cbSize = Marshal.SizeOf<CursorInfo>() };
                if (GetCursorInfo(ref ci) && (ci.flags & 1) != 0) {
                    var hdc = g.GetHdc();
                    // Match the real pointer's hotspot rather than placing its icon center at the click.
                    var hot = Point.Empty;
                    if (GetIconInfo(ci.hCursor, out var icon)) {
                        hot = new Point((int)icon.xHotspot, (int)icon.yHotspot);
                        if (icon.hbmColor != IntPtr.Zero) DeleteObject(icon.hbmColor);
                        if (icon.hbmMask != IntPtr.Zero) DeleteObject(icon.hbmMask);
                    }
                    DrawIconEx(hdc, ci.ptScreenPos.x - bounds.X - hot.X, ci.ptScreenPos.y - bounds.Y - hot.Y, ci.hCursor, 0, 0, 0, IntPtr.Zero, 3);
                    g.ReleaseHdc(hdc);
                }
            }
            using var stream = new MemoryStream();
            bitmap.Save(stream, ImageFormat.Png);
            var image = "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            Volatile.Write(ref latestFrame, new FrameSnapshot(image, Stopwatch.GetTimestamp()));
            Emit(new { type = "frame", time = Time(), width = bitmap.Width, height = bitmap.Height, image });
        } catch { Emit(new { type = "error", message = "Não foi possível capturar o monitor. Janelas protegidas podem impedir a captura." }); }
        finally { Volatile.Write(ref busy, 0); }
    }

    static IntPtr MouseCallback(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0 && active && !paused && ((int)message == 0x0201 || (int)message == 0x0204)) {
            var m = Marshal.PtrToStructure<MouseData>(data);
            var bounds = Screen.AllScreens[displayIndex].Bounds;
            if (bounds.Contains(m.pt.x, m.pt.y)) {
                var clickPoint = new Point(m.pt.x, m.pt.y);
                var target = TargetProbe.BoundsAt(clickPoint, bounds);
                var band = target.IsEmpty
                    ? new Rectangle(clickPoint.X - 32, clickPoint.Y + 3, 64, 7)
                    : new Rectangle(target.Left, target.Bottom - Math.Clamp((int)(target.Height * .3), 5, 12), target.Width, Math.Clamp((int)(target.Height * .3), 5, 12));
                band = Rectangle.Intersect(band, bounds);
                window?.BeginInvoke(() => { if (active && !paused) overlay?.ShowAt(band); });
                var frame = Volatile.Read(ref latestFrame);
                var image = frame != null && Stopwatch.GetElapsedTime(frame.Ticks).TotalMilliseconds < 750 ? frame.Image : null;
                var x = (double)(m.pt.x - bounds.X) / bounds.Width;
                var y = (double)(m.pt.y - bounds.Y) / bounds.Height;
                var time = Time();
                // Never block the hook callback with stdout, capture or network work.
                ThreadPool.QueueUserWorkItem(_ => {
                    var title = new StringBuilder(512);
                    GetWindowText(GetForegroundWindow(), title, title.Capacity);
                    Emit(new { type = "click", time, x, y, button = (int)message == 0x0204 ? "right" : "left", window = title.ToString(), image,
                        target = target.IsEmpty ? null : new { x = (double)(target.Left - bounds.X) / bounds.Width, y = (double)(target.Top - bounds.Y) / bounds.Height, x2 = (double)(target.Right - bounds.X) / bounds.Width, y2 = (double)(target.Bottom - bounds.Y) / bounds.Height } });
                });
            }
        }
        return CallNextHookEx(mouseHook, code, message, data);
    }

    static void StartSpeech()
    {
        StopSpeech();
        try {
            var info = SpeechRecognitionEngine.InstalledRecognizers().FirstOrDefault(r => r.Culture.Name.Equals("pt-BR", StringComparison.OrdinalIgnoreCase));
            if (info == null) { Emit(new { type = "error", message = "Reconhecedor Windows pt-BR não instalado. O áudio continua sendo gravado; escolha outro provedor." });return; }
            speech = new SpeechRecognitionEngine(info);
            speech.LoadGrammar(new DictationGrammar());
            speech.SetInputToDefaultAudioDevice();
            speech.SpeechRecognized += (_, e) => {
                if (active && !paused) Emit(new { type = "transcript", text = e.Result.Text, time = Time(), confidence = e.Result.Confidence, source = "windows" });
            };
            speech.RecognizeAsync(RecognizeMode.Multiple);
        } catch { StopSpeech();Emit(new { type = "error", message = "Reconhecimento de voz Windows indisponível. O áudio original continua sendo gravado." }); }
    }
    static void StopSpeech() { try { speech?.RecognizeAsyncCancel();speech?.Dispose(); } catch { } speech = null; }
    static void Emit(object value) { lock (OutputLock) { Console.WriteLine(JsonSerializer.Serialize(value));Console.Out.Flush(); } }
    static void Shutdown()
    {
        shuttingDown = true;active = false;Timer.Dispose();StopSpeech();
        if (mouseHook != IntPtr.Zero) UnhookWindowsHookEx(mouseHook);
        if (controlHandle != IntPtr.Zero) for (int i = 1; i <= 3; i++) UnregisterHotKey(controlHandle, i);
        overlay?.Dispose();
    }

    sealed class CaptureWindow : Form
    {
        public CaptureWindow() { ShowInTaskbar = false;FormBorderStyle = FormBorderStyle.None;Opacity = 0;Width = 0;Height = 0; }
        protected override void SetVisibleCore(bool value) => base.SetVisibleCore(false);
        protected override void WndProc(ref Message m) {
            if (m.Msg == 0x0312) {
                var id = m.WParam.ToInt32();
                if (id == 1 || active) Emit(new { type = "hotkey", action = id == 1 ? "toggle" : id == 2 ? "mark" : "pause", time = Time() });
            }
            base.WndProc(ref m);
        }
    }
    sealed class ClickOverlay : Form
    {
        readonly System.Windows.Forms.Timer hideTimer = new() { Interval = 650 };
        bool captureExcluded;
        public ClickOverlay() {
            FormBorderStyle = FormBorderStyle.None;ShowInTaskbar = false;TopMost = true;
            BackColor = Color.Magenta;TransparencyKey = Color.Magenta;AutoScaleMode = AutoScaleMode.None;
            Width = 64;Height = 7;DoubleBuffered = true;Opacity = .65;
            hideTimer.Tick += (_, _) => { hideTimer.Stop();Hide(); };
        }
        protected override bool ShowWithoutActivation => true;
        protected override CreateParams CreateParams { get { var p = base.CreateParams;p.ExStyle |= 0x08000000 | 0x20 | 0x80;return p; } }
        protected override void OnHandleCreated(EventArgs e) {
            base.OnHandleCreated(e);
            // Keep the transient click marker out of the original screenshot/video.
            captureExcluded = SetWindowDisplayAffinity(Handle, 0x00000011);
        }
        public void ShowAt(Rectangle band) { if (band.IsEmpty) return;_ = Handle;if (!captureExcluded) return;hideTimer.Stop();Bounds = band;Show();Invalidate();hideTimer.Start(); }
        protected override void OnPaint(PaintEventArgs e) {
            base.OnPaint(e);e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using var brush = new SolidBrush(Color.FromArgb(250, 204, 21));e.Graphics.FillRectangle(brush, ClientRectangle);
        }
        protected override void Dispose(bool disposing) { if (disposing) hideTimer.Dispose();base.Dispose(disposing); }
    }
    delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] struct MouseData { public NativePoint pt; public uint mouseData, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct CursorInfo { public int cbSize, flags;public IntPtr hCursor;public NativePoint ptScreenPos; }
    [StructLayout(LayoutKind.Sequential)] struct IconInfo { [MarshalAs(UnmanagedType.Bool)]public bool fIcon;public uint xHotspot,yHotspot;public IntPtr hbmMask,hbmColor; }
    [DllImport("user32.dll", SetLastError = true)] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint threadId);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string? name);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int max);
    [DllImport("user32.dll")] static extern bool GetCursorInfo(ref CursorInfo info);
    [DllImport("user32.dll")] static extern bool GetIconInfo(IntPtr icon, out IconInfo info);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
    [DllImport("user32.dll")] static extern bool DrawIconEx(IntPtr dc, int x, int y, IntPtr icon, int width, int height, uint step, IntPtr brush, uint flags);
    [DllImport("user32.dll")] static extern bool SetWindowDisplayAffinity(IntPtr window, uint affinity);
}
