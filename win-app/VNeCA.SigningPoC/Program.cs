using System.Security.Cryptography.X509Certificates;
using System.Text.Json;

namespace VNeCA.SigningPoC;

internal sealed class Options
{
    public string? Thumbprint { get; set; }
    public bool List { get; set; }
    public bool GetCertOnly { get; set; }
    public string KeyApi { get; set; } = "capi";
    public string? Reader { get; set; }
    public string Csp { get; set; } = "Microsoft Base Smart Card Crypto Provider";
    public uint CspType { get; set; } = 1;
    public string Ksp { get; set; } = "Microsoft Smart Card Key Storage Provider";
    public string? PreferredProvider { get; set; }
    public int TimeoutSeconds { get; set; } = 60;
    public string Output { get; set; } = Path.Combine("reports", $"vneca-r02-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}.json");
    public static Options Parse(string[] args)
    {
        var result = new Options();
        for (int i = 0; i < args.Length; i++)
        {
            string Need() => ++i < args.Length ? args[i] : throw new ArgumentException("Missing option value.");
            switch (args[i])
            {
                case "--thumbprint": result.Thumbprint = Policy.Thumbprint(Need()); break;
                case "--list": result.List = true; break;
                case "--get-cert": result.GetCertOnly = true; break;
                case "--key-api": result.KeyApi = Need().ToLowerInvariant(); break;
                case "--reader": result.Reader = Need(); break;
                case "--csp": result.Csp = Need(); break;
                case "--csp-type": result.CspType = uint.Parse(Need()); break;
                case "--ksp": result.Ksp = Need(); break;
                case "--provider": result.PreferredProvider = Need(); break;
                case "--timeout-seconds": result.TimeoutSeconds = int.Parse(Need()); break;
                case "--out": result.Output = Path.GetFullPath(Need()); break;
                default: throw new ArgumentException("Unknown option.");
            }
        }
        if (result.KeyApi is not ("capi" or "cng")) throw new ArgumentException("--key-api must be capi or cng.");
        if (result.List && result.GetCertOnly) throw new ArgumentException("--list and --get-cert cannot be combined.");
        if (result.KeyApi == "cng" && result.Reader != null) throw new ArgumentException("--reader is supported with CAPI only.");
        if (result.TimeoutSeconds < 1 || result.TimeoutSeconds > 600) throw new ArgumentException("Timeout must be 1..600 seconds.");
        return result;
    }
}
internal static class Program
{
    private const string Help = """
VNeCA R0.2 - Windows CAPI/CNG test-data signing only
  (no options)                   Interactive GetCertificates, select certificate, confirm signing
  --get-cert                     GetCertificates + selection + chain validation; never sign
  --list                         Silent store/CSP/KSP inventory only
  --thumbprint <SHA1>             Optional filter; normally derived from selected certificate
  --key-api <capi|cng>            GetCertificates provider API (default capi)
  --reader <name>                 Optional CAPI smart-card reader scope
  --provider <name>               Select a binding if the same cert has multiple providers
  --csp <name> --csp-type <uint>   GetCertificates CSP (default Microsoft Base Smart Card, type 1)
  --ksp <name>                    GetCertificates KSP (default Microsoft Smart Card KSP)
  --timeout-seconds <1..600>       Per-worker deadline, default 60 seconds
  --out <path>                    Redacted JSON report (default reports/vneca-r02-*.json)
  --self-test                     Policy and worker isolation tests; no token access or signing
  --help
Run in your interactive Windows account. GET CERT allows provider-owned PIN UI; it never signs.
Select a returned certificate, then type SIGN <displayed thumbprint> to sign fixed test data.
Public certificate reads may succeed without a PIN prompt; this does not prove PIN authentication.
No PIN argument, noninteractive approval, arbitrary-data input, trust bypass or root import.
""";
    public static async Task<int> Main(string[] args)
    {
        if (args.SequenceEqual(new[] { "--worker" })) return await Worker.MainAsync();
        if (args.SequenceEqual(new[] { "--help" })) { Console.WriteLine(Help); return 0; }
        if (args.SequenceEqual(new[] { "--self-test" })) return await SelfTest.Run();
        Options options;
        try { options = Options.Parse(args); }
        catch (Exception e) { Console.Error.WriteLine($"Invalid arguments ({Policy.Error(e)}).\n{Help}"); return 2; }
        if (!OperatingSystem.IsWindows()) { Console.Error.WriteLine("Windows is required."); return 2; }
        var report = new Report { ExpectedThumbprint = options.Thumbprint };
        using var cancelled = new CancellationTokenSource();
        ConsoleCancelEventHandler handler = (_, e) => { e.Cancel = true; cancelled.Cancel(); };
        Console.CancelKeyPress += handler;
        try { await Run(options, report, cancelled.Token); }
        catch (OperationCanceledException) when (cancelled.IsCancellationRequested) { report.Errors.Add("CANCELLED"); }
        catch (Exception e) { report.Errors.Add(Policy.Error(e)); }
        finally { Console.CancelKeyPress -= handler; }
        report.OverallStatus = Policy.Overall(report);
        try
        {
            string path = Path.GetFullPath(options.Output);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            // CreateNew prevents accidentally overwriting an existing report or other file.
            using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await JsonSerializer.SerializeAsync(stream, report, Policy.Json);
            Console.WriteLine($"Crypto: {report.Crypto.Status}; certificate validation: {report.Validation.Status}; overall: {report.OverallStatus}");
            Console.WriteLine($"JSON: {path}");
        }
        catch (Exception e) { Console.Error.WriteLine($"Cannot write report: {Policy.Error(e)}"); return 2; }
        return (options.List || options.GetCertOnly) && report.DiscoveryComplete ? 0 : report.OverallStatus == "PASS" ? 0 : 1;
    }
    private static async Task Run(Options options, Report report, CancellationToken cancellation)
    {
        TimeSpan timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
        if (options.List)
        {
            var inventory = new List<Candidate>();
            foreach (var request in new[]
            {
                new Request { Operation = "store" },
                new Request { Operation = "csp", Provider = options.Csp, ProviderType = options.CspType },
                new Request { Operation = "ksp", Provider = options.Ksp }
            })
            {
                if (cancellation.IsCancellationRequested) break;
                var scan = await Supervisor.Run(request, timeout, cancellation);
                if (scan.Error != null) report.Errors.Add($"{request.Operation}:{scan.Error}");
                report.Errors.AddRange(scan.Warnings);
                inventory.AddRange(scan.Candidates);
            }
            report.Inventory = inventory.Select(c => c.Describe()).ToList();
            foreach (var info in report.Inventory)
                Console.WriteLine($"{info.Thumbprint} | {info.Source} | {info.Provider} | KeySpec={info.KeySpec} | KU={info.KeyUsage}");
            report.DiscoveryComplete = !cancellation.IsCancellationRequested && report.Errors.Count == 0;
            return;
        }
        // Stop before provider interaction when input is redirected; no unattended PIN windows.
        if (Console.IsInputRedirected) { report.Errors.Add("INTERACTIVE_GET_CERT_REQUIRED"); return; }
        Console.WriteLine("GetCertificates will contact the token. Enter PIN only in the middleware dialog if shown.");
        Console.WriteLine("This step never signs. Type GET CERT to continue; anything else cancels.");
        if (await ReadChoice(cancellation) != "GET CERT") { report.Errors.Add("GET_CERT_DECLINED"); return; }
        var retrieval = await Supervisor.Run(new Request
        {
            Operation = options.KeyApi == "cng" ? "get-cert-cng" : "get-cert",
            Provider = options.KeyApi == "cng" ? options.Ksp : options.Csp,
            ProviderType = options.CspType, Reader = options.Reader, AllowProviderUi = true
        }, timeout, cancellation);
        report.CertificateRetrieval = retrieval.Retrieval ?? new RetrievalResult
        {
            Status = "FAIL", Error = retrieval.Error ?? "MISSING_RESULT"
        };
        report.Errors.AddRange(retrieval.Warnings);
        report.Inventory = retrieval.Candidates.Select(c => c.Describe()).ToList();
        if (retrieval.Error != null) { report.Errors.Add(retrieval.Error); return; }
        var matching = Selection.DistinctBindings(retrieval.Candidates).Where(c =>
            (options.Thumbprint == null || c.Describe().Thumbprint == options.Thumbprint) &&
            (options.PreferredProvider == null || string.Equals(c.Binding!.Provider,
                options.PreferredProvider, StringComparison.OrdinalIgnoreCase))).ToList();
        if (matching.Count == 0) { report.Errors.Add("NO_MATCHING_TOKEN_CERTIFICATE"); return; }
        Console.WriteLine("Certificates returned by the token (a public read does not prove PIN authentication):");
        for (int row = 0; row < matching.Count; row++)
        {
            using var item = new X509Certificate2(Convert.FromBase64String(matching[row].Der));
            Console.WriteLine($"[{row + 1}] Subject: {item.Subject}\nIssuer: {item.Issuer}\nThumbprint: {item.Thumbprint}");
            Console.WriteLine($"Provider: {matching[row].Binding!.Provider}; KeySpec={matching[row].Binding!.KeySpec}; Valid: {item.NotBefore:O} .. {item.NotAfter:O}");
            Console.WriteLine($"Key Usage: {matching[row].Describe().KeyUsage}");
        }
        Console.WriteLine("Choose the row for the certificate/key you want to use. No automatic/default selection; Enter cancels.");
        var selected = Selection.Resolve(matching, await ReadChoice(cancellation));
        if (selected == null) { report.Errors.Add("CERTIFICATE_SELECTION_CANCELLED_OR_INVALID"); return; }
        report.Selected = selected.Describe();
        report.DiscoveryComplete = true;
        using var cert = new X509Certificate2(Convert.FromBase64String(selected.Der));
        // Display full identity locally for informed consent; never serialize it to the report.
        Console.WriteLine($"\nSelected certificate:\nSubject: {cert.Subject}\nIssuer: {cert.Issuer}\nThumbprint: {cert.Thumbprint}");
        Console.WriteLine($"Validity: {cert.NotBefore:O} .. {cert.NotAfter:O}\nProvider: {selected.Binding!.Provider}\nKeySpec: {selected.Binding.KeySpec}");
        Console.WriteLine($"Key Usage: {report.Selected.KeyUsage}\nPublic-key OID: {cert.PublicKey.Oid.Value}");
        Console.WriteLine($"\nFixed UTF-8 test data (no newline):\n{Policy.Data}\nSHA-256: {report.TestDataSha256}");
        Console.WriteLine("\nChecking Windows trust and online revocation independently...");
        var chain = await Supervisor.Run(new Request { Operation = "chain", Candidate = selected }, timeout, cancellation);
        report.Validation = chain.Validation ?? new ValidationResult { Status = "FAIL", Error = chain.Error ?? "MISSING_RESULT", RevocationStatus = "UNKNOWN" };
        Console.WriteLine($"Certificate validation: {report.Validation.Status}; revocation: {report.Validation.RevocationStatus}");
        foreach (string status in report.Validation.ChainStatus) Console.WriteLine($"  {status}");
        Console.WriteLine("A trust failure keeps the overall result FAIL, even if the test signature verifies.");
        if (cancellation.IsCancellationRequested) { report.Errors.Add("CANCELLED"); return; }
        if (options.GetCertOnly) return;
        if (!Policy.SigningUsage(cert)) { report.Errors.Add("KEY_USAGE_FORBIDS_SIGNING"); return; }
        try { Console.WriteLine($"Planned algorithm: {Policy.Algorithm(cert)}"); }
        catch (NotSupportedException) { report.Errors.Add("UNSUPPORTED_ALGORITHM"); return; }
        if (Console.IsInputRedirected) { report.Errors.Add("INTERACTIVE_CONSENT_REQUIRED"); return; }
        string expected = $"SIGN {cert.Thumbprint}";
        Console.WriteLine($"\nTo sign ONLY the fixed test data, type exactly: {expected}\nAnything else cancels. PIN is entered only in the middleware dialog. Ctrl+C cancels.");
        string? consent;
        try { consent = await ReadChoice(cancellation); }
        catch (OperationCanceledException) { report.Errors.Add("CANCELLED"); return; }
        if (consent != expected) { report.Errors.Add("CONSENT_DECLINED"); return; }
        report.Consent = true;
        Console.WriteLine($"Opening private key and signing (deadline {options.TimeoutSeconds}s)...");
        var signing = await Supervisor.Run(new Request { Operation = "sign", Candidate = selected, Consent = true }, timeout, cancellation);
        report.Crypto = signing.Crypto ?? new CryptoResult { Status = "FAIL", Error = signing.Error ?? "MISSING_RESULT" };
    }
    private static async Task<string?> ReadChoice(CancellationToken cancellation) =>
        await Task.Run(Console.ReadLine).WaitAsync(cancellation);
}
