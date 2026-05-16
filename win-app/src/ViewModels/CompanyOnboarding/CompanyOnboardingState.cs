// ViewModels/CompanyOnboarding/CompanyOnboardingState.cs

using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;

namespace eIDCA.WinApp.ViewModels.CompanyOnboarding;

public class CompanyOnboardingState
{
    public string PartnerCode    { get; set; } = "";
    public string IdNumber       { get; set; } = "";
    public int    CompanyId      { get; set; } = 1;

    // STEP 1 output — lưu ý: /eid-company/challenge KHÔNG trả về "challenge" riêng
    public string TransactionCode { get; set; } = "";
    public string TokenChallenge  { get; set; } = "";

    // STEP 2 — NFC data
    public RawNfcData? RawData    { get; set; }
    public string AaSignature     { get; set; } = "";
    public string SelfieBase64    { get; set; } = "";
    public DeviceInfoData? DeviceInfo { get; set; }

    // STEP 2 output
    public string TokenSignature  { get; set; } = "";
    public int    Interval        { get; set; } = 3000;
}
