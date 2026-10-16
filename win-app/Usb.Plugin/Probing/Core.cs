using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Net.Pkcs11Interop.Common;
using Net.Pkcs11Interop.HighLevelAPI;

namespace Usb.Plugin.Probing;

public sealed class Options
{
    public string? Output { get; set; }
    public string? Module { get; set; }
    public string? Hash { get; set; }
    public List<string> AllowedSigners { get; } = [];
    public static Options Parse(string[] args)
    {
        Options r = new();
        for (int i=0;i<args.Length;i++)
        {
            string Need() => ++i < args.Length ? args[i] : throw new ArgumentException($"Missing value for {args[i-1]}");
            if(args[i]=="--out") r.Output=Need(); else if(args[i]=="--module") r.Module=Path.GetFullPath(Need()); else if(args[i]=="--sha256") r.Hash=Need(); else if(args[i]=="--allow-signer") r.AllowedSigners.Add(Normalize(Need())); else throw new ArgumentException($"Unknown argument {args[i]}");
        }
        if ((r.Module is null)!=(r.Hash is null)) throw new ArgumentException("--module and --sha256 must be used together.");
        return r;
    }
    public static string Normalize(string s) => string.Concat(s.Where(char.IsLetterOrDigit)).ToUpperInvariant();
}
public sealed class ProbeReport { public DateTimeOffset GeneratedAtUtc {get;set;}=DateTimeOffset.UtcNow; public List<Candidate> Candidates {get;set;}=[]; public string[] SafetyNotes {get;set;}=["DLL filename is not PKCS#11 evidence; raw C_GetFunctionList export is checked before load.","No PIN, C_Login, C_Sign, object modification or middleware change is performed.","Certificate inventory does not demonstrate signing capability."]; }
public sealed class Candidate { public string RequestedPath {get;set;}=""; public string ResolvedPath {get;set;}=""; public Preflight Preflight {get;set;}=new(); public ModuleScan? Scan {get;set;} public string? Skipped {get;set;} }
public sealed class Preflight { public bool Exists {get;set;} public string? Sha256 {get;set;} public string? Architecture {get;set;} public bool Compatible {get;set;} public bool CGetFunctionList {get;set;} public bool SignatureValid {get;set;} public string? SignerThumbprint {get;set;} public List<string> Errors {get;set;}=[]; public bool Allowed => Errors.Count==0; }
public sealed class ModuleScan { public bool LoadedIsolated {get;set;} public string? LibraryDescription {get;set;} public List<Slot> Slots {get;set;}=[]; public List<string> Errors {get;set;}=[]; }
public sealed class Slot { public ulong Id {get;set;} public string? Description {get;set;} public string? TokenLabel {get;set;} public List<string> CertificateLabels {get;set;}=[]; public List<string> Mechanisms {get;set;}=[]; public List<string> Errors {get;set;}=[]; }

public sealed class Probe
{
    public async Task<ProbeReport> RunAsync(Options options)
    {
        ProbeReport report=new(); string win=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        foreach(var c in new[]{(Path.Combine(win,"System32","bit4ipki.dll"), Environment.Is64BitOperatingSystem&&!Environment.Is64BitProcess?Path.Combine(win,"Sysnative","bit4ipki.dll"):Path.Combine(win,"System32","bit4ipki.dll")),(Path.Combine(win,"SysWOW64","bit4ipki.dll"),Path.Combine(win,"SysWOW64","bit4ipki.dll"))})
        { var p=PreflightCheck(c.Item2,options.AllowedSigners); Candidate x=new(){RequestedPath=c.Item1,ResolvedPath=c.Item2,Preflight=p}; report.Candidates.Add(x); if(!p.Allowed){x.Skipped="Preflight rejected native load.";continue;} x.Scan=await RunWorker(c.Item2,p.Sha256!,options.AllowedSigners); }
        return report;
    }
    private static Preflight PreflightCheck(string path,List<string> signers)
    { Preflight p=new(); if(!File.Exists(path)){p.Errors.Add("File does not exist.");return p;} p.Exists=true; byte[] b=File.ReadAllBytes(path);p.Sha256=Convert.ToHexString(SHA256.HashData(b));try{ushort m=BitConverter.ToUInt16(b,BitConverter.ToInt32(b,0x3c)+4);p.Architecture=m==0x14c?"x86":m==0x8664?"x64":"unknown";p.Compatible=(m==0x14c&&RuntimeInformation.ProcessArchitecture==Architecture.X86)||(m==0x8664&&RuntimeInformation.ProcessArchitecture==Architecture.X64);p.CGetFunctionList=System.Text.Encoding.ASCII.GetString(b).Contains("C_GetFunctionList",StringComparison.Ordinal);using X509Certificate2 cert=new(X509Certificate.CreateFromSignedFile(path));p.SignerThumbprint=Options.Normalize(cert.Thumbprint??"");p.SignatureValid=WinTrust(path)==0;if(!p.Compatible)p.Errors.Add("Architecture mismatch.");if(!p.CGetFunctionList)p.Errors.Add("C_GetFunctionList export missing.");if(!p.SignatureValid)p.Errors.Add("WinVerifyTrust failed.");if(signers.Count>0&&!signers.Contains(p.SignerThumbprint,StringComparer.OrdinalIgnoreCase))p.Errors.Add("Signer not allowlisted.");}catch(Exception e){p.Errors.Add(e.GetType().Name+": "+e.Message);}return p; }
    private static async Task<ModuleScan> RunWorker(string module,string hash,List<string> signers)
    { ProcessStartInfo s=new(){FileName=Environment.ProcessPath!,UseShellExecute=false,RedirectStandardOutput=true,CreateNoWindow=true};if(Path.GetFileNameWithoutExtension(s.FileName).Equals("dotnet",StringComparison.OrdinalIgnoreCase))s.ArgumentList.Add(Assembly.GetExecutingAssembly().Location);s.ArgumentList.Add("--module");s.ArgumentList.Add(module);s.ArgumentList.Add("--sha256");s.ArgumentList.Add(hash);foreach(var x in signers){s.ArgumentList.Add("--allow-signer");s.ArgumentList.Add(x);}using Process p=Process.Start(s)!;Task<string> o=p.StandardOutput.ReadToEndAsync();if(await Task.WhenAny(p.WaitForExitAsync(),Task.Delay(30000))!=p.WaitForExitAsync()){p.Kill(true);return new ModuleScan{Errors={"Worker timeout."}};}try{return JsonSerializer.Deserialize<ModuleScan>(await o)??new ModuleScan{Errors={"Empty worker JSON."}};}catch(Exception e){return new ModuleScan{Errors={e.Message}};} }
    [DllImport("wintrust.dll",ExactSpelling=true)] static extern uint WinVerifyTrust(IntPtr h,ref Guid a,IntPtr d);
    static uint WinTrust(string f){var fi=new WFI{cbStruct=(uint)Marshal.SizeOf<WFI>(),pcwszFilePath=f};IntPtr fp=Marshal.AllocHGlobal(Marshal.SizeOf<WFI>()),dp=IntPtr.Zero;try{Marshal.StructureToPtr(fi,fp,false);var d=new WTD{cbStruct=(uint)Marshal.SizeOf<WTD>(),dwUIChoice=2,dwUnionChoice=1,pFile=fp};dp=Marshal.AllocHGlobal(Marshal.SizeOf<WTD>());Marshal.StructureToPtr(d,dp,false);Guid g=new("00AAC56B-CD44-11D0-8CC2-00C04FC295EE");return WinVerifyTrust(IntPtr.Zero,ref g,dp);}finally{if(dp!=IntPtr.Zero)Marshal.FreeHGlobal(dp);Marshal.FreeHGlobal(fp);}}
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct WFI{public uint cbStruct;public string? pcwszFilePath;public IntPtr hFile,pgKnownSubject;} [StructLayout(LayoutKind.Sequential)] struct WTD{public uint cbStruct;public IntPtr a,b;public uint dwUIChoice,dwRevocationChecks,dwUnionChoice;public IntPtr pFile;public uint x;public IntPtr y,z;public uint flags,ctx;public IntPtr sig;}
}
public static class Worker
{ public static ModuleScan Scan(Options o){ModuleScan r=new(); if(!File.Exists(o.Module)||!string.Equals(Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(o.Module!))),o.Hash,StringComparison.OrdinalIgnoreCase)){r.Errors.Add("Hash changed; load refused.");return r;}try{var f=new Pkcs11InteropFactories();using IPkcs11Library l=f.Pkcs11LibraryFactory.LoadPkcs11Library(f,o.Module!,AppType.MultiThreaded,InitType.WithFunctionList);r.LoadedIsolated=true;r.LibraryDescription=l.GetInfo().LibraryDescription;foreach(var sl in l.GetSlotList(SlotsType.WithOrWithoutTokenPresent)){var s=new Slot{Id=sl.SlotId,Description=sl.GetSlotInfo().SlotDescription};if(sl.GetSlotInfo().SlotFlags.TokenPresent){s.TokenLabel=sl.GetTokenInfo().Label;s.Mechanisms=sl.GetMechanismList().Select(x=>x.ToString()).ToList();using ISession se=sl.OpenSession(SessionType.ReadOnly);var t=new List<IObjectAttribute>{se.Factories.ObjectAttributeFactory.Create(CKA.CKA_CLASS,CKO.CKO_CERTIFICATE)};foreach(var h in se.FindAllObjects(t)){var a=se.GetAttributeValue(h,new List<CKA>{CKA.CKA_LABEL});if(!a[0].CannotBeRead)s.CertificateLabels.Add(a[0].GetValueAsString());}}r.Slots.Add(s);}}catch(Exception e){r.Errors.Add(e.GetType().Name+": "+e.Message);}return r;} }
