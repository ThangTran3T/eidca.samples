using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;

namespace VNeCA.SigningPoC;

internal static class Worker
{
    public static async Task<int> MainAsync()
    {
        Response response;
        try
        {
            var request = JsonSerializer.Deserialize<Request>(await Console.In.ReadToEndAsync(), Policy.Json)
                ?? throw new ArgumentException();
            response = request.Operation switch
            {
                "get-cert" when request.AllowProviderUi => GetCertificates(request, false),
                "get-cert-cng" when request.AllowProviderUi => GetCertificates(request, true),
                "store" => new Response { Candidates = Native.ScanStore() },
                "csp" => new Response { Candidates = Native.ScanCsp(request.Provider!, request.ProviderType) },
                "ksp" => ScanKsp(request.Provider!),
                "sign" when request.Consent && request.Candidate != null => new Response { Crypto = Native.Sign(request.Candidate) },
                "chain" when request.Candidate != null => new Response { Validation = Validate(request.Candidate) },
                "test-stall" => await Stall(),
                "test-error" => throw new InvalidOperationException("PRIVATE-DATA-MUST-NOT-LEAK"),
                _ => throw new ArgumentException()
            };
        }
        catch (Exception e) { response = new Response { Error = Policy.Error(e) }; }
        await Console.Out.WriteAsync(JsonSerializer.Serialize(response, Policy.Json));
        return response.Error == null ? 0 : 1;
    }
    private static Response GetCertificates(Request request, bool cng)
    {
        var response = new Response
        {
            Retrieval = new RetrievalResult { Api = cng ? "CNG/GetCertificates" : "CAPI/GetCertificates" }
        };
        try
        {
            response.Candidates = cng
                ? Native.ScanKsp(request.Provider!, response.Warnings, allowUi: true)
                : Native.GetCertificates(request.Provider!, request.ProviderType, request.Reader, response.Warnings);
            response.Retrieval.Status = response.Candidates.Count > 0 ? "PASS" : "FAIL";
            if (response.Candidates.Count == 0) response.Error = "TOKEN_CERTIFICATE_NOT_FOUND";
        }
        catch (Exception e)
        {
            response.Error = Policy.Error(e);
            response.Retrieval.Status = "FAIL";
            response.Retrieval.Error = response.Error;
        }
        return response;
    }
    private static Response ScanKsp(string provider)
    {
        var response = new Response();
        response.Candidates = Native.ScanKsp(provider, response.Warnings);
        return response;
    }
    private static async Task<Response> Stall()
    {
        await Task.Delay(Timeout.Infinite);
        return new Response();
    }
    private static ValidationResult Validate(Candidate candidate)
    {
        var result = new ValidationResult { CheckedAtUtc = DateTimeOffset.UtcNow };
        try
        {
            // Public certificate only; validation does not reopen or use the token.
            using var cert = new X509Certificate2(Convert.FromBase64String(candidate.Der));
            using var chain = new X509Chain();
            chain.ChainPolicy.TrustMode = X509ChainTrustMode.System;
            chain.ChainPolicy.RevocationMode = X509RevocationMode.Online;
            chain.ChainPolicy.RevocationFlag = X509RevocationFlag.ExcludeRoot;
            chain.ChainPolicy.VerificationFlags = X509VerificationFlags.NoFlag;
            chain.ChainPolicy.UrlRetrievalTimeout = TimeSpan.FromSeconds(10);
            chain.ChainPolicy.VerificationTime = DateTime.Now;
            result.ChainBuilt = chain.Build(cert);
            result.ChainStatus = chain.ChainStatus.Select(s => s.Status.ToString()).ToArray();
            foreach (var element in chain.ChainElements)
                result.Elements.Add(new ChainElementInfo(element.Certificate.Thumbprint,
                    Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(element.Certificate.RawData)),
                    element.ChainElementStatus.Select(s => s.Status.ToString()).ToArray()));
            var flags = chain.ChainStatus.Aggregate(X509ChainStatusFlags.NoError, (f, s) => f | s.Status);
            result.RevocationStatus = (flags & X509ChainStatusFlags.Revoked) != 0 ? "REVOKED"
                : (flags & (X509ChainStatusFlags.RevocationStatusUnknown | X509ChainStatusFlags.OfflineRevocation |
                    X509ChainStatusFlags.PartialChain)) != 0 ? "UNKNOWN"
                : result.ChainBuilt ? "GOOD_WITHIN_WINDOWS_POLICY" : "NOT_ESTABLISHED";
            result.Status = result.ChainBuilt && flags == X509ChainStatusFlags.NoError ? "PASS" : "FAIL";
        }
        catch (Exception e) { result.Status = "FAIL"; result.Error = Policy.Error(e); result.RevocationStatus = "UNKNOWN"; }
        return result;
    }
}
internal static class Supervisor
{
    public static async Task<Response> Run(Request request, TimeSpan timeout, CancellationToken cancellation)
    {
        var start = new ProcessStartInfo
        {
            FileName = Environment.ProcessPath ?? throw new InvalidOperationException(),
            UseShellExecute = false, RedirectStandardInput = true, RedirectStandardOutput = true,
            RedirectStandardError = true, CreateNoWindow = true
        };
        if (Path.GetFileNameWithoutExtension(start.FileName).Equals("dotnet", StringComparison.OrdinalIgnoreCase))
            start.ArgumentList.Add(Assembly.GetExecutingAssembly().Location);
        start.ArgumentList.Add("--worker");
        using var process = new Process { StartInfo = start };
        if (!process.Start()) return new Response { Error = "WORKER_START_FAILED" };
        // Drain both pipes immediately; stderr is discarded, never added to reports.
        Task<string> output = process.StandardOutput.ReadToEndAsync();
        Task errors = process.StandardError.BaseStream.CopyToAsync(Stream.Null);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        deadline.CancelAfter(timeout);
        try
        {
            await process.StandardInput.WriteAsync(JsonSerializer.Serialize(request, Policy.Json).AsMemory(), deadline.Token);
            process.StandardInput.Close();
            await process.WaitForExitAsync(deadline.Token);
            string json = await output.WaitAsync(deadline.Token);
            await errors.WaitAsync(deadline.Token);
            var response = JsonSerializer.Deserialize<Response>(json, Policy.Json)
                ?? new Response { Error = "WORKER_EMPTY_RESULT" };
            if (process.ExitCode != 0 && response.Error == null) response.Error = "WORKER_NONZERO_EXIT";
            return response;
        }
        catch (OperationCanceledException)
        {
            Stop(process);
            return new Response { Error = cancellation.IsCancellationRequested ? "CANCELLED" : "WORKER_TIMEOUT" };
        }
        catch (Exception e)
        {
            Stop(process);
            return new Response { Error = Policy.Error(e) };
        }
    }
    private static void Stop(Process process)
    {
        // Do not wait indefinitely for native provider cleanup or detached middleware UI.
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
        catch (InvalidOperationException) { }
        catch (System.ComponentModel.Win32Exception) { }
    }
}
