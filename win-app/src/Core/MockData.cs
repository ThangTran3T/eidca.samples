// Core/MockData.cs
// Mock data tĩnh tương đương với mockSocket.js trong web-app.

namespace eIDCA.WinApp.Core;

public static class MockData
{
    // ── Device Info ───────────────────────────────────────────────────────────
    public static DeviceInfoData DeviceInfo => new()
    {
        Version       = "1.1",
        SerialNfc     = "00123000012",
        SerialDevice  = "0022300111",
        Date          = DateTime.UtcNow.ToString("O"),
    };

    // ── Personal Info (id:2) ─────────────────────────────────────────────────
    public static PersonalInfoData PersonalInfo => new()
    {
        IdCode                  = "001087012345",
        OldIdCode               = "123456789",
        PersonName              = "NGUYỄN VĂN AN",
        DateOfBirth             = "15051990",
        Gender                  = "Nam",
        Nationality             = "Việt Nam",
        Race                    = "Kinh",
        Religion                = "Không",
        OriginPlace             = "Hà Nội",
        ResidencePlace          = "Số 1, Phố Huế, Hai Bà Trưng, Hà Nội",
        PersonalIdentification  = "Sẹo nhỏ dưới mắt trái",
        IssueDate               = "20032021",
        ExpiryDate              = "15052030",
        FatherName              = "Nguyễn Văn B",
        MotherName              = "Trần Thị C",
        WifeName                = "",
        Qr                      = "001087012345|123456789|Nguyễn Văn An|15051990|Nam|Hà Nội|20032021",
    };

    // ── Avatar / Raw NFC (id:4) ───────────────────────────────────────────────
    // 1×1 grey pixel PNG (Base64)
    public const string PlaceholderImageBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    public static AvatarImageData AvatarImage => new()
    {
        ImgData = PlaceholderImageBase64,
        Dg1     = "YTExMTExMTExMTExMTExMTExMTExMTE=",
        Dg2     = "aW1hZ2VCYXNlNjRvZlBob3RvSW1hZ2U=",
        Dg13    = "ZGcxM0RhdGFFeHRlbmRlZEluZm9ybWF=",
        Dg14    = "ZGcxNERhdGFCYXNlNjQ=",
        Dg15    = "ZGcxNVJTQVB1YmxpY0tleURhdGFCYXM=",
        Sod     = "TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2I=",
    };

    // ── DS Cert (id:5) ────────────────────────────────────────────────────────
    public static DsCertData DsCert => new()
    {
        Ca = "1",
        Aa = new AaData { AaSignature = "" },
        Pa = new PaData
        {
            HashDg1  = "aGFzaF9kZzE=",
            HashDg2  = "aGFzaF9kZzI=",
            HashDg13 = "aGFzaF9kZzEz",
            HashDg14 = "aGFzaF9kZzE0",
            HashDg15 = "aGFzaF9kZzE1",
            Cert     = "MIIFaDCCBBCgAwIBAgIQ...",
            Sod      = "TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2I=",
        },
    };
}

// ── Data record types ─────────────────────────────────────────────────────────

public record DeviceInfoData
{
    public string Version      { get; init; } = "";
    public string SerialNfc    { get; init; } = "";
    public string SerialDevice { get; init; } = "";
    public string Date         { get; init; } = "";
}

public record PersonalInfoData
{
    public string IdCode                 { get; init; } = "";
    public string OldIdCode              { get; init; } = "";
    public string PersonName             { get; init; } = "";
    public string DateOfBirth            { get; init; } = "";
    public string Gender                 { get; init; } = "";
    public string Nationality            { get; init; } = "";
    public string Race                   { get; init; } = "";
    public string Religion               { get; init; } = "";
    public string OriginPlace            { get; init; } = "";
    public string ResidencePlace         { get; init; } = "";
    public string PersonalIdentification { get; init; } = "";
    public string IssueDate              { get; init; } = "";
    public string ExpiryDate             { get; init; } = "";
    public string FatherName             { get; init; } = "";
    public string MotherName             { get; init; } = "";
    public string WifeName               { get; init; } = "";
    public string Qr                     { get; init; } = "";
}

public record AvatarImageData
{
    public string ImgData { get; init; } = "";
    public string Dg1     { get; init; } = "";
    public string Dg2     { get; init; } = "";
    public string Dg13    { get; init; } = "";
    public string Dg14    { get; init; } = "";
    public string Dg15    { get; init; } = "";
    public string Sod     { get; init; } = "";
}

public record DsCertData
{
    public string Ca { get; init; } = "";
    public AaData  Aa { get; init; } = new();
    public PaData  Pa { get; init; } = new();
}

public record AaData
{
    public string AaSignature { get; init; } = "";
}

public record PaData
{
    public string HashDg1  { get; init; } = "";
    public string HashDg2  { get; init; } = "";
    public string HashDg13 { get; init; } = "";
    public string HashDg14 { get; init; } = "";
    public string HashDg15 { get; init; } = "";
    public string Cert     { get; init; } = "";
    public string Sod      { get; init; } = "";
}
