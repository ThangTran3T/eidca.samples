using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace VNeCA.SigningPoC;

internal static partial class Native
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct ProviderInfo
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string? Container;
        [MarshalAs(UnmanagedType.LPWStr)] public string? Provider;
        public uint Type, Flags, Count;
        public IntPtr Parameters;
        public uint Spec;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct KeyName { public IntPtr Name, Algorithm; public uint Spec, Flags; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Padding { [MarshalAs(UnmanagedType.LPWStr)] public string Algorithm; }

    [DllImport("crypt32.dll", SetLastError = true)]
    private static extern bool CertGetCertificateContextProperty(IntPtr cert, uint id, IntPtr data, ref uint size);
    [DllImport("crypt32.dll", SetLastError = true)]
    private static extern bool CertSetCertificateContextProperty(IntPtr cert, uint id, uint flags, ref ProviderInfo data);
    [DllImport("crypt32.dll", SetLastError = true)]
    private static extern IntPtr CertEnumCertificatesInStore(IntPtr store, IntPtr previous);
    [DllImport("crypt32.dll")]
    private static extern bool CertFreeCertificateContext(IntPtr cert);
    [DllImport("crypt32.dll")]
    private static extern bool CertCloseStore(IntPtr store, uint flags);
    [DllImport("crypt32.dll", SetLastError = true)]
    private static extern bool CryptAcquireCertificatePrivateKey(IntPtr cert, uint flags, IntPtr reserved,
        out IntPtr key, out uint spec, [MarshalAs(UnmanagedType.Bool)] out bool mustFree);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "CryptAcquireContextW")]
    private static extern bool CryptAcquireContext(out IntPtr provider, string? container, string name, uint type, uint flags);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CryptGetProvParam(IntPtr provider, uint param, byte[] data, ref uint size, uint flags);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CryptReleaseContext(IntPtr provider, uint flags);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CryptGetUserKey(IntPtr provider, uint spec, out IntPtr key);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CryptGetKeyParam(IntPtr key, uint param, byte[]? data, ref uint size, uint flags);
    [DllImport("advapi32.dll")]
    private static extern bool CryptDestroyKey(IntPtr key);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CryptCreateHash(IntPtr provider, uint algorithm, IntPtr key, uint flags, out IntPtr hash);
    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CryptHashData(IntPtr hash, byte[] data, uint size, uint flags);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, EntryPoint = "CryptSignHashW", SetLastError = true)]
    private static extern bool CryptSignHash(IntPtr hash, uint spec, string? description, uint flags, byte[]? signature, ref uint size);
    [DllImport("advapi32.dll")]
    private static extern bool CryptDestroyHash(IntPtr hash);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptOpenStorageProvider(out IntPtr provider, string name, uint flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptEnumKeys(IntPtr provider, string? scope, out IntPtr name, ref IntPtr state, uint flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptOpenKey(IntPtr provider, out IntPtr key, string name, uint spec, uint flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptGetProperty(IntPtr obj, string property, byte[]? data, int size, out int written, uint flags);
    [DllImport("ncrypt.dll")]
    private static extern int NCryptSignHash(IntPtr key, IntPtr padding, byte[] hash, int size, byte[]? signature,
        int capacity, out int written, uint flags);
    [DllImport("ncrypt.dll")]
    private static extern int NCryptFreeObject(IntPtr obj);
    [DllImport("ncrypt.dll")]
    private static extern int NCryptFreeBuffer(IntPtr buffer);

    private static void Check(bool success, string op)
    {
        if (!success) throw new NativeFailure(op, Marshal.GetLastWin32Error());
    }
    private static void Check(int status, string op)
    {
        if (status != 0) throw new NativeFailure(op, status);
    }
    internal static Binding? GetBinding(X509Certificate2 cert)
    {
        uint size = 0;
        if (!CertGetCertificateContextProperty(cert.Handle, 2, IntPtr.Zero, ref size)) return null;
        IntPtr memory = Marshal.AllocHGlobal(checked((int)size));
        try
        {
            Check(CertGetCertificateContextProperty(cert.Handle, 2, memory, ref size), "CertGetProviderInfo");
            var info = Marshal.PtrToStructure<ProviderInfo>(memory);
            if (info.Count != 0) throw new NotSupportedException("Provider parameters are unsupported; refusing to discard them.");
            return new Binding(info.Provider ?? "", info.Container ?? "", info.Type, info.Spec, info.Flags);
        }
        finally { Marshal.FreeHGlobal(memory); }
    }
    internal static void Attach(X509Certificate2 cert, Binding binding)
    {
        // Set on a detached in-memory certificate only; no Windows store writes.
        var info = new ProviderInfo { Provider = binding.Provider, Container = binding.Container,
            Type = binding.ProviderType, Spec = binding.KeySpec, Flags = binding.Flags };
        Check(CertSetCertificateContextProperty(cert.Handle, 2, 0, ref info), "CertSetInMemoryProviderInfo");
    }
    internal static Candidate Capture(X509Certificate2 cert, string source, Binding? binding = null) =>
        new(source, Convert.ToBase64String(cert.RawData), binding ?? GetBinding(cert));

    internal static List<Candidate> ScanStore()
    {
        var result = new List<Candidate>();
        // Never access LocalMachine private-key context or modify the user's store.
        using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
        store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
        foreach (var cert in store.Certificates)
        {
            using (cert) result.Add(Capture(cert, "CurrentUser/My"));
        }
        return result;
    }
    private static byte[] CapiProperty(IntPtr provider, uint property)
    {
        byte[] data = new byte[16384];
        uint size = (uint)data.Length;
        Check(CryptGetProvParam(provider, property, data, ref size, 0), "CryptGetProvParam");
        return data[..checked((int)size)];
    }
    internal static List<Candidate> ScanCsp(string name, uint type)
    {
        // VERIFYCONTEXT + SILENT: enumerate public certificates without a PIN dialog.
        Check(CryptAcquireContext(out var provider, null, name, type, 0xF0000040), "CryptAcquireContextDiscovery");
        try
        {
            var bytes = CapiProperty(provider, 42); // PP_USER_CERTSTORE, not unused CERT_STORE_PROV_SMART_CARD.
            IntPtr store = IntPtr.Size == 8 ? new IntPtr(BitConverter.ToInt64(bytes)) : new IntPtr(BitConverter.ToInt32(bytes));
            if (store == IntPtr.Zero) throw new InvalidOperationException("Empty smart-card store.");
            var result = new List<Candidate>();
            IntPtr context = IntPtr.Zero;
            try
            {
                while ((context = CertEnumCertificatesInStore(store, context)) != IntPtr.Zero)
                {
                    using var cert = new X509Certificate2(context);
                    result.Add(Capture(cert, "SmartCard/CSP"));
                }
                int error = Marshal.GetLastWin32Error();
                if (error != unchecked((int)0x80092004) && error != 0)
                    throw new NativeFailure("CertEnumCertificatesInStore", error);
            }
            finally
            {
                if (context != IntPtr.Zero) CertFreeCertificateContext(context);
                CertCloseStore(store, 0);
            }
            return result;
        }
        finally { CryptReleaseContext(provider, 0); }
    }
    private static byte[] CngProperty(IntPtr obj, string property)
    {
        Check(NCryptGetProperty(obj, property, null, 0, out int size, 0), "NCryptGetPropertySize");
        if (size < 0 || size > 1024 * 1024) throw new InvalidOperationException("Invalid property size.");
        byte[] bytes = new byte[size];
        Check(NCryptGetProperty(obj, property, bytes, size, out int written, 0), "NCryptGetProperty");
        return bytes[..written];
    }
    internal static List<Candidate> ScanKsp(string name, List<string> warnings, bool allowUi = false)
    {
        Check(NCryptOpenStorageProvider(out var provider, name, 0), "NCryptOpenStorageProvider");
        IntPtr state = IntPtr.Zero;
        try
        {
            if (allowUi && (BitConverter.ToUInt32(CngProperty(provider, "Impl Type")) & 1) == 0)
                throw new PocFailure("HARDWARE_PROVIDER_REQUIRED");
            uint discoveryFlags = allowUi ? 0u : 0x40u;
            var result = new List<Candidate>();
            while (true)
            {
                int status = NCryptEnumKeys(provider, null, out var keyName, ref state, discoveryFlags);
                if (status == unchecked((int)0x8009002A)) break; // NTE_NO_MORE_ITEMS
                Check(status, "NCryptEnumKeys");
                try
                {
                    var entry = Marshal.PtrToStructure<KeyName>(keyName);
                    string container = Marshal.PtrToStringUni(entry.Name) ?? throw new InvalidOperationException();
                    Check(NCryptOpenKey(provider, out var key, container, entry.Spec, discoveryFlags), "NCryptOpenKeyDiscovery");
                    try
                    {
                        using var cert = new X509Certificate2(CngProperty(key, "SmartCardKeyCertificate"));
                        result.Add(Capture(cert, "SmartCard/KSP", new Binding(name, container, 0, uint.MaxValue, 0)));
                    }
                    finally { NCryptFreeObject(key); }
                }
                catch (NativeFailure e) when (allowUi && IsPinCancellationOrFailure(e.Code)) { throw; }
                catch (Exception e) { warnings.Add("KSP_KEY_SKIPPED:" + Policy.Error(e)); }
                finally { NCryptFreeBuffer(keyName); }
            }
            return result;
        }
        finally
        {
            if (state != IntPtr.Zero) NCryptFreeBuffer(state);
            NCryptFreeObject(provider);
        }
    }
    internal static CryptoResult Sign(Candidate candidate)
    {
        var result = new CryptoResult();
        try
        {
            using var cert = candidate.Open();
            if (candidate.Binding == null) throw new PocFailure("MISSING_PRIVATE_KEY_BINDING");
            if (!Policy.SigningUsage(cert)) throw new PocFailure("KEY_USAGE_FORBIDS_SIGNING");
            result.Algorithm = Policy.Algorithm(cert);
            // ALLOW_NCRYPT | COMPARE_KEY | NO_HEALING. No SILENT flag: middleware may display PIN UI.
            Check(CryptAcquireCertificatePrivateKey(cert.Handle, 0x1000C, IntPtr.Zero,
                out var key, out uint spec, out bool mustFree), "CryptAcquireCertificatePrivateKey");
            result.PrivateKeyAccessible = true;
            result.KeySpec = spec;
            try
            {
                byte[] signature;
                if (spec == uint.MaxValue)
                {
                    result.Api = "CNG/NCryptSignHash";
                    var providerBytes = CngProperty(key, "Provider Handle");
                    IntPtr provider = IntPtr.Size == 8 ? new IntPtr(BitConverter.ToInt64(providerBytes)) : new IntPtr(BitConverter.ToInt32(providerBytes));
                    try
                    {
                        result.Provider = Encoding.Unicode.GetString(CngProperty(provider, "Name")).TrimEnd('\0');
                        result.HardwareBacked = (BitConverter.ToUInt32(CngProperty(provider, "Impl Type")) & 1) != 0;
                    }
                    finally { NCryptFreeObject(provider); }
                    CheckCertificateUnchanged(cert.RawData, CngProperty(key, "SmartCardKeyCertificate"));
                    result.ProviderKeyAlgorithm = Encoding.Unicode.GetString(CngProperty(key, "Algorithm Group")).TrimEnd('\0');
                    result.ProviderKeyUsage = BitConverter.ToUInt32(CngProperty(key, "Key Usage"));
                    if ((result.ProviderKeyUsage.Value & 2) == 0) throw new PocFailure("PROVIDER_KEY_FORBIDS_SIGNING");
                    string expectedGroup = result.Algorithm == "RSA-PKCS1-SHA256" ? "RSA" : "ECDSA";
                    if (result.ProviderKeyAlgorithm != expectedGroup) throw new PocFailure("PROVIDER_KEY_ALGORITHM_MISMATCH");
                    CheckProvider(result, candidate.Binding);
                    signature = SignCng(key, result.Algorithm);
                }
                else
                {
                    result.Api = "CAPI/CryptSignHash";
                    result.Provider = Encoding.Default.GetString(CapiProperty(key, 4)).TrimEnd('\0');
                    result.HardwareBacked = (BitConverter.ToUInt32(CapiProperty(key, 3)) & 1) != 0;
                    if (spec != 1 && spec != 2) throw new PocFailure("UNSUPPORTED_KEYSPEC");
                    Check(CryptGetUserKey(key, spec, out var userKey), "CryptGetUserKey");
                    try
                    {
                        CheckCertificateUnchanged(cert.RawData, KeyCertificate(userKey));
                        byte[] algorithmBytes = new byte[4];
                        uint algorithmSize = 4;
                        Check(CryptGetKeyParam(userKey, 7, algorithmBytes, ref algorithmSize, 0), "CryptGetKeyAlgorithm");
                        uint algorithm = BitConverter.ToUInt32(algorithmBytes);
                        result.ProviderKeyAlgorithm = $"CALG_0x{algorithm:X8}";
                        if (algorithm != 0x2400 && algorithm != 0xA400) throw new PocFailure("PROVIDER_KEY_ALGORITHM_MISMATCH");
                    }
                    finally { CryptDestroyKey(userKey); }
                    if (result.Algorithm != "RSA-PKCS1-SHA256") throw new PocFailure("CAPI_REQUIRES_RSA");
                    CheckProvider(result, candidate.Binding);
                    signature = SignCapi(key, spec);
                }
                result.SignatureCreated = true;
                result.SignatureBase64 = Convert.ToBase64String(signature);
                result.Verified = Verify(cert, result.Algorithm, signature);
                result.Status = result.Verified ? "PASS" : "FAIL";
            }
            finally
            {
                if (mustFree)
                {
                    if (spec == uint.MaxValue) NCryptFreeObject(key);
                    else CryptReleaseContext(key, 0);
                }
            }
        }
        catch (Exception e) { result.Status = "FAIL"; result.Error = Policy.Error(e); }
        return result;
    }
    private static void CheckProvider(CryptoResult result, Binding binding)
    {
        if (result.HardwareBacked != true) throw new PocFailure("HARDWARE_PROVIDER_REQUIRED");
        if (!string.Equals(result.Provider, binding.Provider, StringComparison.OrdinalIgnoreCase))
            throw new PocFailure("ACQUIRED_PROVIDER_MISMATCH");
    }
    private static byte[] SignCapi(IntPtr key, uint spec)
    {
        Check(CryptCreateHash(key, 0x800C, IntPtr.Zero, 0, out var hash), "CryptCreateHashSHA256");
        try
        {
            Check(CryptHashData(hash, Policy.Bytes, (uint)Policy.Bytes.Length, 0), "CryptHashData");
            uint size = 0;
            Check(CryptSignHash(hash, spec, null, 0, null, ref size), "CryptSignHashSize");
            byte[] signature = new byte[size];
            Check(CryptSignHash(hash, spec, null, 0, signature, ref size), "CryptSignHash");
            Array.Resize(ref signature, checked((int)size));
            Array.Reverse(signature); // CAPI RSA is little endian; .NET verification expects big endian.
            return signature;
        }
        finally { CryptDestroyHash(hash); }
    }
    private static byte[] SignCng(IntPtr key, string algorithm)
    {
        bool rsa = algorithm == "RSA-PKCS1-SHA256";
        IntPtr padding = IntPtr.Zero;
        try
        {
            if (rsa)
            {
                padding = Marshal.AllocHGlobal(Marshal.SizeOf<Padding>());
                Marshal.StructureToPtr(new Padding { Algorithm = "SHA256" }, padding, false);
            }
            byte[] hash = SHA256.HashData(Policy.Bytes);
            uint flags = rsa ? 2u : 0u;
            Check(NCryptSignHash(key, padding, hash, hash.Length, null, 0, out int size, flags), "NCryptSignHashSize");
            byte[] signature = new byte[size];
            Check(NCryptSignHash(key, padding, hash, hash.Length, signature, size, out int written, flags), "NCryptSignHash");
            return signature[..written];
        }
        finally
        {
            if (padding != IntPtr.Zero)
            {
                Marshal.DestroyStructure<Padding>(padding);
                Marshal.FreeHGlobal(padding);
            }
        }
    }
    internal static bool Verify(X509Certificate2 cert, string algorithm, byte[] signature)
    {
        if (algorithm == "RSA-PKCS1-SHA256")
        {
            using var rsa = cert.GetRSAPublicKey();
            return rsa != null && rsa.VerifyData(Policy.Bytes, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        }
        using var ec = cert.GetECDsaPublicKey();
        return ec != null && ec.VerifyData(Policy.Bytes, signature, HashAlgorithmName.SHA256,
            DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
    }
}
