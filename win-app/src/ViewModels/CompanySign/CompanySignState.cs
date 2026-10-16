// ViewModels/CompanySign/CompanySignState.cs

using eIDCA.WinApp.Services;

namespace eIDCA.WinApp.ViewModels.CompanySign;

public class CompanySignState
{
    public string PartnerCode      { get; set; } = "";
    public string IdNumber         { get; set; } = "";
    public int    CompanyId        { get; set; } = 1;
    public string SelectedFilePath { get; set; } = "";

    // STEP 1 output
    public string        TransactionCode { get; set; } = "";
    public string        TokenSign       { get; set; } = "";
    public List<DocInfo> Docs            { get; set; } = [];

    // STEP 2 output
    public string          AaSignature  { get; set; } = "";
    public string          SelfieBase64 { get; set; } = "";
    public List<SignedDoc> SignedDocs    { get; set; } = [];
    public string          TokenSigned  { get; set; } = "";
}
