using System.Diagnostics;
using System.Windows.Automation;

// UI Automation can block when another application is unresponsive. Keep all
// provider calls on a dedicated background MTA thread, away from hooks/capture.
internal static class TargetProbe
{
    sealed record Sample(Point Point, Rectangle Bounds, long Ticks);
    static Sample? latest;
    static bool started;

    public static void Start(Func<bool> isRecording)
    {
        if (started) return;
        started = true;
        var thread = new Thread(() => {
            while (true) {
                if (!isRecording()) { Volatile.Write(ref latest, null);Thread.Sleep(100);continue; }
                try {
                    var ticks = Stopwatch.GetTimestamp();
                    var point = Cursor.Position;
                    var element = AutomationElement.FromPoint(new System.Windows.Point(point.X, point.Y));
                    var rect = Rectangle.Empty;
                    for (var depth = 0; element != null && depth < 3; depth++) {
                        var current = element.Current;
                        var bounds = current.BoundingRectangle;
                        var type = current.ControlType;
                        if (!current.IsPassword && !current.IsOffscreen && !bounds.IsEmpty
                            && type != ControlType.Window && type != ControlType.Pane
                            && type != ControlType.Document && type != ControlType.Group) {
                            var candidate = Rectangle.FromLTRB((int)Math.Floor(bounds.Left), (int)Math.Floor(bounds.Top), (int)Math.Ceiling(bounds.Right), (int)Math.Ceiling(bounds.Bottom));
                            if (candidate.Contains(point) && candidate.Width >= 6 && candidate.Width <= 1000 && candidate.Height >= 8 && candidate.Height <= 120) {
                                rect = candidate;
                                break;
                            }
                        }
                        element = TreeWalker.ControlViewWalker.GetParent(element);
                    }
                    Volatile.Write(ref latest, rect.IsEmpty ? null : new Sample(point, rect, ticks));
                } catch { Volatile.Write(ref latest, null); }
                Thread.Sleep(100);
            }
        }) { IsBackground = true, Name = "Playbook accessible target" };
        thread.SetApartmentState(ApartmentState.MTA);
        thread.Start();
    }

    public static Rectangle BoundsAt(Point point, Rectangle screen)
    {
        var sample = Volatile.Read(ref latest);
        if (sample == null || Stopwatch.GetElapsedTime(sample.Ticks).TotalMilliseconds > 650
            || Math.Abs(sample.Point.X - point.X) > 32 || Math.Abs(sample.Point.Y - point.Y) > 32
            || !sample.Bounds.Contains(point)) return Rectangle.Empty;
        var clipped = Rectangle.Intersect(sample.Bounds, screen);
        return clipped.Width >= 6 && clipped.Height >= 8 && clipped.Width <= screen.Width * .7 ? clipped : Rectangle.Empty;
    }
}
