// ViewModels/PersonalOnboarding/Step2SignatureViewModel.cs
// STEP 2: Gửi NFC data + AA signature + selfie → POST /ca/api/eid-personal/signature

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.Common;
using System.Windows.Media.Imaging;

namespace eIDCA.WinApp.ViewModels.PersonalOnboarding;

public partial class Step2SignatureViewModel : ObservableObject
{
    private readonly PersonalOnboardingState _state;
    private readonly EidcaApiService          _api;
    private          IDeviceService            _device;
    private          TaskCompletionSource<AaResponseEventArgs>? _aaTcs;

    public CodePanelViewModel CodePanel { get; } = new() { RequestTitle = "POST /eid-personal/signature" };

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SendSignatureCommand))]
    private bool _isActive   = false;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SendSignatureCommand))]
    private bool _isLoading  = false;

    [ObservableProperty] private string       _statusMsg  = "";
    [ObservableProperty] private bool         _isDone     = false;
    [ObservableProperty] private bool         _hasRawData = false;
    [ObservableProperty] private string       _nfcSummary = "Chờ dữ liệu NFC...";
    [ObservableProperty] private BitmapSource? _selfieImage;
    [ObservableProperty] private string        _phone  = "";
    [ObservableProperty] private string        _email  = "";

    public event Action? OnDone;

    public Step2SignatureViewModel(PersonalOnboardingState state, EidcaApiService api, IDeviceService device)
    {
        _state  = state;
        _api    = api;
        _device = device;

        _device.AaResponseReceived += OnAaResponse;
    }

    public void Activate()
    {
        IsActive = true;
        StatusMsg = HasRawData ? "✅ Dữ liệu NFC sẵn sàng. Nhấn 'Gửi Signature' để ký." : "⏳ Đang chờ dữ liệu NFC từ đầu đọc...";
    }

    public void SetRawData(RawNfcData rawData)
    {
        _state.RawData = rawData;
        HasRawData     = true;
        NfcSummary     = $"✅ NFC data: SOD={Truncate(rawData.Sod)}, DG1={Truncate(rawData.Dg1)}";
        if (IsActive) StatusMsg = "✅ Dữ liệu NFC sẵn sàng. Nhấn 'Gửi Signature' để ký.";
    }

    public void SetSelfie(string base64)
    {
        _state.SelfieBase64 = base64;
        SelfieImage         = Base64ToBitmap(base64);
    }

    [RelayCommand]
    private async Task RetryNfcAsync()
    {
        StatusMsg  = "🔄 Đang giả lập đọc thẻ...";
        HasRawData = false;
        NfcSummary = "Đang đọc thẻ...";
        await _device.SimulateCardReadAsync();
    }

    [RelayCommand(CanExecute = nameof(CanSendSignature))]
    private async Task SendSignatureAsync()
    {
        if (_state.RawData is null)
        {
            StatusMsg = "❌ Chưa có dữ liệu NFC. Đặt thẻ lên đầu đọc hoặc nhấn Retry.";
            return;
        }

        IsLoading = true;
        StatusMsg = "🔐 Đang ký Active Authentication trên chip thẻ...";

        try
        {
            // 1. SendAA → đợi AaResponseReceived
            _aaTcs = new TaskCompletionSource<AaResponseEventArgs>();
            await _device.SendAAAsync(_state.Challenge);
            var aaResult = await _aaTcs.Task.WaitAsync(TimeSpan.FromSeconds(10));
            _state.AaSignature = aaResult.AaSignature;

            StatusMsg = "📤 Đang gửi signature lên server...";

            // 2. Build info object
            var info = new
            {
                ip_address    = GetLocalIp(),
                machine_name  = Environment.MachineName,
                machine_type  = "Desktop",
                operating_system = "Windows",
                version       = Environment.OSVersion.VersionString,
                serial_device = _state.DeviceInfo?.SerialDevice ?? "",
                phone         = Phone,
                email         = Email,
                image         = _state.SelfieBase64,
            };

            var req = new
            {
                code             = _state.PartnerCode,
                transaction_code = _state.TransactionCode,
                token_challenge  = _state.TokenChallenge,
                raw_data         = _state.RawData,
                info,
                signature        = _state.AaSignature,
            };
            CodePanel.SetRequest(req);
            CodePanel.SetLoading();

            var data = await _api.PersonalSendSignatureAsync(
                _state.TransactionCode, _state.TokenChallenge,
                _state.RawData, info, _state.AaSignature);

            _state.TokenSignature = data.GetProperty("token_signature").GetString() ?? "";
            _state.Interval       = data.TryGetProperty("interval", out var iv)
                                  ? int.TryParse(iv.GetString(), out var ivN) ? ivN : 3000
                                  : 3000;

            CodePanel.SetResponse(data, PanelState.Success);
            StatusMsg = "✅ Gửi Signature thành công. Chờ cấp CTS...";
            IsDone    = true;
            OnDone?.Invoke();
        }
        catch (Exception ex)
        {
            CodePanel.SetError(ex.Message);
            StatusMsg = $"❌ Lỗi: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
            _aaTcs    = null;
        }
    }

    partial void OnIsActiveChanged(bool value)  => SendSignatureCommand.NotifyCanExecuteChanged();
    partial void OnIsLoadingChanged(bool value) => SendSignatureCommand.NotifyCanExecuteChanged();

    private bool CanSendSignature() => IsActive && !IsLoading;

    private void OnAaResponse(object? s, AaResponseEventArgs e)
    {
        _aaTcs?.TrySetResult(e);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static BitmapSource? Base64ToBitmap(string base64)
    {
        try
        {
            var bytes = Convert.FromBase64String(base64);
            using var ms = new System.IO.MemoryStream(bytes);
            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.StreamSource  = ms;
            bmp.CacheOption   = BitmapCacheOption.OnLoad;
            bmp.EndInit();
            bmp.Freeze();
            return bmp;
        }
        catch { return null; }
    }

    private static string Truncate(string s, int len = 20) =>
        s.Length > len ? s[..len] + "..." : s;

    private static string GetLocalIp()
    {
        try
        {
            var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
            return host.AddressList
                .FirstOrDefault(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                ?.ToString() ?? "127.0.0.1";
        }
        catch { return "127.0.0.1"; }
    }
}
