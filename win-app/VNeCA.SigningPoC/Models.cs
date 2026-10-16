using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;

namespace VNeCA.SigningPoC;

internal static class Policy
{
    public const string Data = "VNeCA R0.2 | Bit4id CAPI/CNG PoC | TEST DATA ONLY | v1";
    public static readonly byte[] Bytes = System.Text.Encoding.UTF8.GetBytes(Data);
    public static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    public static string Thumbprint(string value)
    {
        string result = string.Concat(value.Where(c => !char.IsWhiteSpace(c) && c != ':' && c != '\u200e')).ToUpperInvariant();
        if (result.Length != 40 || result.Any(c => !Uri.IsHexDigit(c)))
            throw new ArgumentException("Thumbprint must contain exactly 40 hexadecimal SHA-1 digits.");
        return result;
    }
    public static bool SigningUsage(X509Certificate2 cert)
    {
        var usage = cert.Extensions.OfType<X509KeyUsageExtension>().FirstOrDefault();
        return usage == null || (usage.KeyUsages & (X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.NonRepudiation)) != 0;
    }
    public static string Algorithm(X509Certificate2 cert) => cert.PublicKey.Oid.Value switch
    {
        "1.2.840.113549.1.1.1" => "RSA-PKCS1-SHA256",
        "1.2.840.10045.2.1" => "ECDSA-SHA256-P1363",
        _ => throw new NotSupportedException("Certificate public-key algorithm is unsupported by this PoC.")
    };
    // Exception messages can contain DN, key-container names and middleware data.
    public static string Error(Exception e) => e is PocFailure p ? p.Code : e is NativeFailure n
        ? $"{n.Operation}:0x{n.Code:X8}" : $"{e.GetType().Name}:0x{e.HResult:X8}";
    public static string Overall(Report r) =>
        r.DiscoveryComplete && r.Selected != null && r.Consent && r.Crypto.Verified &&
        r.Crypto.PrivateKeyAccessible && r.Crypto.HardwareBacked == true &&
        r.Validation.Status == "PASS" ? "PASS" : "FAIL";
}
internal sealed class PocFailure(string code) : Exception
{
    public string Code { get; } = code;
}
internal sealed class NativeFailure(string operation, int code) : Exception
{
    public string Operation { get; } = operation;
    public int Code { get; } = code;
}
internal sealed record Binding(string Provider, string Container, uint ProviderType, uint KeySpec, uint Flags);
internal sealed record Candidate(string Source, string Der, Binding? Binding)
{
    public X509Certificate2 Open()
    {
        var cert = new X509Certificate2(Convert.FromBase64String(Der));
        if (Binding != null) Native.Attach(cert, Binding);
        return cert;
    }
    public CertificateInfo Describe()
    {
        using var cert = new X509Certificate2(Convert.FromBase64String(Der));
        var usage = cert.Extensions.OfType<X509KeyUsageExtension>().FirstOrDefault();
        return new CertificateInfo(
            cert.Thumbprint, Convert.ToHexString(SHA256.HashData(cert.RawData)), Source,
            cert.NotBefore.ToUniversalTime(), cert.NotAfter.ToUniversalTime(),
            cert.PublicKey.Oid.Value, cert.SignatureAlgorithm.Value,
            usage?.KeyUsages.ToString() ?? "Absent (unrestricted)",
            cert.Extensions.OfType<X509EnhancedKeyUsageExtension>().SelectMany(e =>
                e.EnhancedKeyUsages.Cast<Oid>().Select(o => o.Value ?? "")).ToArray(),
            Binding?.Provider, Binding?.ProviderType, Binding?.KeySpec);
    }
}
internal sealed record CertificateInfo(string Thumbprint, string CertificateSha256, string Source,
    DateTime NotBeforeUtc, DateTime NotAfterUtc, string? PublicKeyOid, string? CertificateSignatureOid,
    string KeyUsage, string[] EnhancedKeyUsageOids, string? Provider, uint? ProviderType, uint? KeySpec);
internal sealed class CryptoResult
{
    public string Status { get; set; } = "NOT_RUN";
    public string? Provider { get; set; }
    public string? Api { get; set; }
    public uint? KeySpec { get; set; }
    public bool? HardwareBacked { get; set; }
    public bool PrivateKeyAccessible { get; set; }
    public string? Algorithm { get; set; }
    public string? ProviderKeyAlgorithm { get; set; }
    public uint? ProviderKeyUsage { get; set; }
    public bool SignatureCreated { get; set; }
    public bool Verified { get; set; }
    public string? SignatureBase64 { get; set; }
    public string? Error { get; set; }
}
internal sealed class ValidationResult
{
    public string Status { get; set; } = "NOT_RUN";
    public bool ChainBuilt { get; set; }
    public string TrustMode { get; set; } = "WindowsSystem";
    public string RevocationMode { get; set; } = "Online";
    public string RevocationScope { get; set; } = "ExcludeRoot";
    public string RevocationStatus { get; set; } = "NOT_RUN";
    public DateTimeOffset? CheckedAtUtc { get; set; }
    public string[] ChainStatus { get; set; } = [];
    public List<ChainElementInfo> Elements { get; set; } = [];
    public string? Error { get; set; }
}
internal sealed record ChainElementInfo(string Thumbprint, string CertificateSha256, string[] Status);
internal sealed class Report
{
    public string Version { get; set; } = "VNeCA-R0.2";
    public DateTimeOffset GeneratedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public string OverallStatus { get; set; } = "FAIL";
    public string? ExpectedThumbprint { get; set; }
    public string SelectionMode { get; set; } = "UserSelectedFromToken";
    public RetrievalResult CertificateRetrieval { get; set; } = new();
    public bool DiscoveryComplete { get; set; }
    public bool Consent { get; set; }
    public string TestData { get; set; } = Policy.Data;
    public string TestDataSha256 { get; set; } = Convert.ToHexString(SHA256.HashData(Policy.Bytes));
    public List<CertificateInfo> Inventory { get; set; } = [];
    public CertificateInfo? Selected { get; set; }
    public CryptoResult Crypto { get; set; } = new();
    public ValidationResult Validation { get; set; } = new();
    public List<string> Errors { get; set; } = [];
}
internal sealed class Request
{
    public string Operation { get; set; } = "";
    public string? Provider { get; set; }
    public string? Reader { get; set; }
    public bool AllowProviderUi { get; set; }
    public uint ProviderType { get; set; } = 1;
    public Candidate? Candidate { get; set; }
    public bool Consent { get; set; }
}
internal sealed class Response
{
    public List<Candidate> Candidates { get; set; } = [];
    public List<string> Warnings { get; set; } = [];
    public RetrievalResult? Retrieval { get; set; }
    public CryptoResult? Crypto { get; set; }
    public ValidationResult? Validation { get; set; }
    public string? Error { get; set; }
}

internal sealed class RetrievalResult
{
    public string Status { get; set; } = "NOT_RUN";
    public string? Api { get; set; }
    public string PinUi { get; set; } = "MiddlewareManaged";
    public string PinAuthentication { get; set; } = "NOT_PROVEN_BY_CERTIFICATE_READ";
    public string? Error { get; set; }
}
internal static class Selection
{
    public static List<Candidate> DistinctBindings(IEnumerable<Candidate> candidates) =>
        candidates.Where(c => c.Binding != null).DistinctBy(c => (c.Der, c.Binding)).ToList();

    // The row is explicitly chosen from this session's results, never a fixed certificate index.
    public static Candidate? Resolve(IReadOnlyList<Candidate> candidates, string? userChoice) =>
        int.TryParse(userChoice, out int row) && row >= 1 && row <= candidates.Count
            ? candidates[row - 1] : null;
}
