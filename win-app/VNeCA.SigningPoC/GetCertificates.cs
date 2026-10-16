using System.Runtime.InteropServices;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace VNeCA.SigningPoC;

internal static partial class Native
{
    internal static bool IsPinCancellationOrFailure(int code) => code is
        1223 or 86 or unchecked((int)0x80090036) or unchecked((int)0x80100002) or
        unchecked((int)0x8010006B) or unchecked((int)0x8010006C) or unchecked((int)0x8010006E) or
        unchecked((int)0x8010002A);

    internal static void CheckCertificateUnchanged(byte[] selected, byte[] current)
    {
        if (!selected.AsSpan().SequenceEqual(current)) throw new PocFailure("TOKEN_CERTIFICATE_CHANGED");
    }

    private static byte[] KeyCertificate(IntPtr key)
    {
        uint size = 0;
        Check(CryptGetKeyParam(key, 26, null, ref size, 0), "GetCertificateSize");
        if (size == 0 || size > 1024 * 1024) throw new PocFailure("INVALID_CERTIFICATE_SIZE");
        byte[] der = new byte[size];
        Check(CryptGetKeyParam(key, 26, der, ref size, 0), "GetCertificate");
        return der[..checked((int)size)];
    }

    // Does not require a thumbprint, export a key or create a signature.
    // The provider owns any PIN dialog. Public reads may succeed without PIN authentication.
    internal static List<Candidate> GetCertificates(string providerName, uint type, string? reader, List<string> warnings)
    {
        string? scope = string.IsNullOrWhiteSpace(reader) ? null : $@"\\.\{reader}\";
        // Existing/default container; no VERIFYCONTEXT, SILENT, NEWKEYSET or DELETEKEYSET.
        Check(CryptAcquireContext(out var provider, scope, providerName, type, 0), "GetCertificatesAcquireContext");
        try
        {
            if ((BitConverter.ToUInt32(CapiProperty(provider, 3)) & 1) == 0)
                throw new PocFailure("HARDWARE_PROVIDER_REQUIRED");
            try { return ReadProviderCertificates(provider); }
            catch (NativeFailure e) when (e.Code is 87 or unchecked((int)0x8009000A) or unchecked((int)0x80090029))
            {
                warnings.Add("USER_CERTSTORE_UNSUPPORTED_USING_KEY_CERTIFICATE");
            }
            string actualProvider = Encoding.Default.GetString(CapiProperty(provider, 4)).TrimEnd('\0');
            string container = Encoding.Default.GetString(CapiProperty(provider, 6)).TrimEnd('\0');
            var certificates = new List<Candidate>();
            foreach (uint spec in new uint[] { 1, 2 })
            {
                if (!CryptGetUserKey(provider, spec, out var key))
                {
                    int error = Marshal.GetLastWin32Error();
                    if (error == unchecked((int)0x8009000D)) // NTE_NO_KEY
                    {
                        warnings.Add($"KEYSPEC_{spec}_NOT_PRESENT");
                        continue;
                    }
                    throw new NativeFailure("GetCertificateUserKey", error); // No automatic PIN retries.
                }
                try
                {
                    using var certificate = new X509Certificate2(KeyCertificate(key));
                    certificates.Add(Capture(certificate, "SmartCard/GetCert/CAPI",
                        new Binding(actualProvider, container, type, spec, 0)));
                }
                finally { CryptDestroyKey(key); }
            }
            return certificates;
        }
        finally { CryptReleaseContext(provider, 0); }
    }

    private static List<Candidate> ReadProviderCertificates(IntPtr provider)
    {
        byte[] bytes = CapiProperty(provider, 42);
        IntPtr store = IntPtr.Size == 8 ? new IntPtr(BitConverter.ToInt64(bytes)) : new IntPtr(BitConverter.ToInt32(bytes));
        if (store == IntPtr.Zero) throw new PocFailure("EMPTY_SMART_CARD_STORE");
        IntPtr context = IntPtr.Zero;
        var result = new List<Candidate>();
        try
        {
            while ((context = CertEnumCertificatesInStore(store, context)) != IntPtr.Zero)
            {
                using var certificate = new X509Certificate2(context);
                result.Add(Capture(certificate, "SmartCard/GetCert/CAPI"));
            }
            int error = Marshal.GetLastWin32Error();
            if (error != unchecked((int)0x80092004) && error != 0)
                throw new NativeFailure("GetCertificatesEnumeration", error);
            return result;
        }
        finally
        {
            if (context != IntPtr.Zero) CertFreeCertificateContext(context);
            CertCloseStore(store, 0);
        }
    }
}
