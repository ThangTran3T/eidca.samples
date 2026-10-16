using System.Diagnostics;
using System.Text.Json;

namespace VNeCA.SigningPoC;

internal static class SelfTest
{
    public static async Task<int> Run()
    {
        int checks = 0;
        void Assert(bool condition, string name)
        {
            if (!condition) throw new InvalidOperationException(name);
            checks++;
            Console.WriteLine($"PASS {name}");
        }
        try
        {
            string fingerprint = new('A', 40);
            Assert(Policy.Thumbprint(string.Join(":", Enumerable.Repeat("aa", 20))) == fingerprint, "normalize thumbprint");
            foreach (string invalid in new[] { "0", new string('G', 40), new string('A', 39) + "-", fingerprint + "!" })
            {
                bool rejected = false;
                try { Policy.Thumbprint(invalid); } catch (ArgumentException) { rejected = true; }
                Assert(rejected, "reject invalid thumbprint");
            }
            Assert(Options.Parse([]).Thumbprint == null, "GetCertificates needs no pre-known thumbprint");
            Assert(Options.Parse(["--get-cert"]).GetCertOnly, "certificate retrieval only mode");
            var choices = new List<Candidate>
            {
                new("token", "cert-a", new Binding("hardware", "key-a", 1, 1, 0)),
                new("token", "cert-b", new Binding("hardware", "key-b", 1, 2, 0))
            };
            Assert(ReferenceEquals(Selection.Resolve(choices, "2"), choices[1]), "explicit selection uses chosen certificate");
            Assert(Selection.Resolve(choices, "") == null && Selection.Resolve(choices, "0") == null &&
                Selection.Resolve(choices, "3") == null, "no default or out-of-range selection");
            Assert(Selection.Resolve(choices.Take(1).ToList(), "") == null, "single certificate still needs selection");
            Assert(Selection.DistinctBindings(choices.Concat(choices)).Count == 2, "duplicate binding removal preserves distinct keys");
            bool changed = false;
            try { Native.CheckCertificateUnchanged([1, 2], [1, 3]); } catch (PocFailure) { changed = true; }
            Assert(changed, "token certificate change refused before signing");
            Native.CheckCertificateUnchanged([1, 2], [1, 2]);
            Assert(Native.IsPinCancellationOrFailure(unchecked((int)0x8010006B)) &&
                Native.IsPinCancellationOrFailure(1223), "wrong PIN and user cancellation are terminal");
            var getCertRefused = await Supervisor.Run(new Request { Operation = "get-cert" },
                TimeSpan.FromSeconds(5), CancellationToken.None);
            Assert(getCertRefused.Error != null && getCertRefused.Candidates.Count == 0,
                "worker refuses UI retrieval without interaction authorization");
            var r = new Report
            {
                DiscoveryComplete = true, Consent = true,
                Selected = new CertificateInfo(fingerprint, "", "", DateTime.MinValue, DateTime.MaxValue, "", "", "", [], "", 1, 2),
                Crypto = new CryptoResult { Verified = true, PrivateKeyAccessible = true, HardwareBacked = true },
                Validation = new ValidationResult { Status = "PASS" }
            };
            Assert(Policy.Overall(r) == "PASS", "complete result passes");
            r.Validation.Status = "FAIL";
            Assert(Policy.Overall(r) == "FAIL", "valid signature cannot override trust failure");
            r.Validation.Status = "NOT_RUN";
            Assert(Policy.Overall(r) == "FAIL", "unknown trust cannot pass");
            r.Validation.Status = "PASS"; r.Consent = false;
            Assert(Policy.Overall(r) == "FAIL", "missing consent cannot pass");
            r.Consent = true; r.Crypto.HardwareBacked = false;
            Assert(Policy.Overall(r) == "FAIL", "software provider cannot pass");
            var refused = await Supervisor.Run(new Request { Operation = "sign", Consent = false }, TimeSpan.FromSeconds(5), CancellationToken.None);
            Assert(refused.Error != null && refused.Crypto == null, "worker refuses missing consent");
            var error = await Supervisor.Run(new Request { Operation = "test-error" }, TimeSpan.FromSeconds(5), CancellationToken.None);
            Assert(error.Error != null && !JsonSerializer.Serialize(error).Contains("PRIVATE-DATA"), "worker error redaction");
            var watch = Stopwatch.StartNew();
            var timeout = await Supervisor.Run(new Request { Operation = "test-stall" }, TimeSpan.FromMilliseconds(500), CancellationToken.None);
            Assert(timeout.Error == "WORKER_TIMEOUT" && watch.Elapsed < TimeSpan.FromSeconds(5), "stalled native worker deadline");
            using var cancel = new CancellationTokenSource(500);
            var cancelled = await Supervisor.Run(new Request { Operation = "test-stall" }, TimeSpan.FromSeconds(10), cancel.Token);
            Assert(cancelled.Error == "CANCELLED", "worker cancellation");
            Console.WriteLine($"{checks} checks passed. No certificate-store/token access or signing performed.");
            return 0;
        }
        catch (Exception e) { Console.Error.WriteLine($"Self-test failed: {e.Message}"); return 1; }
    }
}
