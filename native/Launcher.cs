using System.Diagnostics;
using System.Runtime.InteropServices;

internal static class Launcher
{
    public static void Run()
    {
        var root = AppContext.BaseDirectory;
        var runtime = Path.Combine(root, "runtime", "node.exe");
        var server = Path.Combine(root, "server.cjs");
        if (!File.Exists(runtime) || !File.Exists(server)) {
            MessageBox(IntPtr.Zero, "Extraia todo o ZIP antes de abrir o aplicativo. Mantenha o executável junto das pastas runtime e dist.", "Playbook Studio", 0x10);return;
        }
        try {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
            var health = http.GetStringAsync("http://127.0.0.1:4317/api/health").GetAwaiter().GetResult();
            if (health.Contains("Playbook Studio")) { Process.Start(new ProcessStartInfo("http://127.0.0.1:4317") { UseShellExecute = true });return; }
        } catch { }
        try {
            var info = new ProcessStartInfo(runtime) { WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true };
            info.ArgumentList.Add("--use-env-proxy");info.ArgumentList.Add(server);info.ArgumentList.Add("--production");info.ArgumentList.Add("--open");info.ArgumentList.Add("--portable");
            info.Environment["PLAYBOOK_ROOT"] = root;
            using var child = Process.Start(info) ?? throw new IOException();
            var errors = child.StandardError.ReadToEndAsync();
            var output = child.StandardOutput.ReadToEndAsync();
            child.WaitForExit();
            if (child.ExitCode != 0) {
                MessageBox(IntPtr.Zero, "O serviço local não pôde iniciar. Verifique se a porta 4317 está livre e se a política da empresa permite executar este aplicativo portátil.", "Playbook Studio", 0x10);
            }
        } catch {
            MessageBox(IntPtr.Zero, "Não foi possível iniciar o aplicativo. Confira a extração completa e as permissões de execução do Windows.", "Playbook Studio", 0x10);
        }
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int MessageBox(IntPtr hwnd, string text, string caption, uint type);
}
