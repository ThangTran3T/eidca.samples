namespace VNeCA.SigningPoC;

internal static class GuiProgram
{
    [STAThread]
    private static int Main(string[] args)
    {
        // Same executable acts as a bounded provider worker, with redirected JSON pipes.
        if (args.SequenceEqual(new[] { "--worker" })) return Worker.MainAsync().GetAwaiter().GetResult();
        ApplicationConfiguration.Initialize();
        using var form = new MainForm();
        if (args.SequenceEqual(new[] { "--smoke-test" }))
        {
            int exit = 1;
            form.Shown += async (_, _) =>
            {
                try
                {
                    form.AssertInitialState();
                    var denied = await Supervisor.Run(new Request { Operation = "sign", Consent = false },
                        TimeSpan.FromSeconds(5), CancellationToken.None);
                    if (denied.Error == null || denied.Crypto != null) throw new InvalidOperationException("Missing signing consent was accepted.");
                    var deniedUi = await Supervisor.Run(new Request { Operation = "get-cert" },
                        TimeSpan.FromSeconds(5), CancellationToken.None);
                    if (deniedUi.Error == null) throw new InvalidOperationException("Missing provider UI authorization was accepted.");
                    var timeout = await Supervisor.Run(new Request { Operation = "test-stall" },
                        TimeSpan.FromMilliseconds(500), CancellationToken.None);
                    if (timeout.Error != "WORKER_TIMEOUT") throw new InvalidOperationException("Worker deadline failed.");
                    using var cancelled = new CancellationTokenSource(500);
                    var cancel = await Supervisor.Run(new Request { Operation = "test-stall" },
                        TimeSpan.FromSeconds(5), cancelled.Token);
                    if (cancel.Error != "CANCELLED") throw new InvalidOperationException("Worker cancellation failed.");
                    Console.WriteLine("PASS: WinForms layout, initial state, consent guards, GUI worker JSON, timeout and cancellation. No token access or signing.");
                    exit = 0;
                }
                catch (Exception e) { Console.Error.WriteLine("FAIL: " + Policy.Error(e)); }
                finally { form.Close(); }
            };
            Application.Run(form);
            return exit;
        }
        if (args.Length != 0) return 2;
        Application.Run(form);
        return 0;
    }
}
