// Core/AppConfig.cs
// Quản lý cấu hình runtime — đọc từ appsettings.json, có thể thay đổi qua UI.

namespace eIDCA.WinApp.Core;

/// <summary>
/// Cấu hình runtime của ứng dụng.
/// Singleton — inject qua DI hoặc truy cập qua AppConfig.Current.
/// </summary>
public class AppConfig
{
    // ── Singleton ─────────────────────────────────────────────────────────────
    public static AppConfig Current { get; private set; } = new();

    // ── Mode ──────────────────────────────────────────────────────────────────
    /// <summary>true = Mock Mode, false = Live Mode</summary>
    public bool IsMock { get; set; } = true;

    // ── API ───────────────────────────────────────────────────────────────────
    public string ApiBaseUrl  => IsMock ? MockApiBaseUrl  : LiveApiBaseUrl;
    public string ApiKey      => IsMock ? MockApiKey      : LiveApiKey;
    public string PartnerCode => IsMock ? MockPartnerCode : LivePartnerCode;

    // Mock API defaults
    public string MockApiBaseUrl  { get; set; } = "http://localhost:3001";
    public string MockApiKey      { get; set; } = "MOCK_API_KEY_DEMO";
    public string MockPartnerCode { get; set; } = "PARTNER_DEMO_001";

    // Live API — nhập qua ModeToggle UI
    public string LiveApiBaseUrl  { get; set; } = "https://api.eidca.vn";
    public string LiveApiKey      { get; set; } = "";
    public string LivePartnerCode { get; set; } = "";

    // ── Socket ────────────────────────────────────────────────────────────────
    public string SocketNfcUrl { get; set; } = "https://192.168.5.1:8000";
    public string SocketCamUrl { get; set; } = "https://192.168.5.1:9000";

    // ── Loader ────────────────────────────────────────────────────────────────
    /// <summary>
    /// Khởi tạo từ appsettings.json (gọi trong App.xaml.cs).
    /// </summary>
    public static AppConfig Load(Microsoft.Extensions.Configuration.IConfiguration config)
    {
        var c = new AppConfig
        {
            IsMock           = config["AppMode"]?.Equals("Mock", StringComparison.OrdinalIgnoreCase) ?? true,
            MockApiBaseUrl   = config["MockApi:BaseUrl"]    ?? "http://localhost:3001",
            MockApiKey       = config["MockApi:ApiKey"]     ?? "MOCK_API_KEY_DEMO",
            MockPartnerCode  = config["MockApi:PartnerCode"] ?? "PARTNER_DEMO_001",
            LiveApiBaseUrl   = config["LiveApi:BaseUrl"]    ?? "https://api.eidca.vn",
            LiveApiKey       = config["LiveApi:ApiKey"]     ?? "",
            LivePartnerCode  = config["LiveApi:PartnerCode"] ?? "",
            SocketNfcUrl     = config["Socket:NfcUrl"]      ?? "https://192.168.5.1:8000",
            SocketCamUrl     = config["Socket:CamUrl"]      ?? "https://192.168.5.1:9000",
        };
        Current = c;
        return c;
    }
}
