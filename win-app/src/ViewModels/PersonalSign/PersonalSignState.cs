// ViewModels/PersonalSign/PersonalSignState.cs

using eIDCA.WinApp.Services;

namespace eIDCA.WinApp.ViewModels.PersonalSign;

public class PersonalSignState
{
    public string PartnerCode     { get; set; } = "";
    public string IdNumber        { get; set; } = "";
    public string SelectedFilePath { get; set; } = "";
    public bool   IsMock          { get; set; }

    // STEP 1 output
    public string     TransactionCode { get; set; } = "";
    public string     TokenSign       { get; set; } = "";
    public List<DocInfo> Docs         { get; set; } = [];

    // STEP 2 output
    public string          AaSignature  { get; set; } = "";
    public string          SelfieBase64 { get; set; } = "";
    public List<SignedDoc> SignedDocs    { get; set; } = [];
    public string          TokenSigned  { get; set; } = "";
}
