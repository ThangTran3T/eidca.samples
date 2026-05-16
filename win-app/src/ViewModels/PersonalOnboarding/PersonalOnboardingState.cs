// ViewModels/PersonalOnboarding/PersonalOnboardingState.cs
// Shared state truyền qua 3 bước — tương đương state object trong index.js

using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;

namespace eIDCA.WinApp.ViewModels.PersonalOnboarding;

/// <summary>
/// Shared state cho luồng Đăng ký CTS Cá nhân (3 bước).
/// Tương đương với state object trong personal-onboarding/index.js.
/// </summary>
public class PersonalOnboardingState
{
    // Config
    public string PartnerCode { get; set; } = "";

    // STEP 1 input
    public string IdNumber { get; set; } = "";

    // STEP 1 output
    public string TransactionCode { get; set; } = "";
    public string Challenge       { get; set; } = "";
    public string TokenChallenge  { get; set; } = "";

    // STEP 2 — NFC data (từ socket event id:4)
    public RawNfcData? RawData    { get; set; }    // { sod, dg1, dg2, dg13, dg15 }
    public string AaSignature     { get; set; } = ""; // từ event id:7
    public string SelfieBase64    { get; set; } = "";
    public DeviceInfoData? DeviceInfo { get; set; }

    // STEP 2 output
    public string TokenSignature  { get; set; } = "";
    public int    Interval        { get; set; } = 3000;
}
