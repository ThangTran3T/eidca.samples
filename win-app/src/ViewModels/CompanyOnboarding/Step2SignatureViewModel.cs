// ViewModels/CompanyOnboarding/Step2SignatureViewModel.cs
// POST /ca/api/eid-company/signature
// Payload info gọn hơn: chỉ phone, email, image (không có ip/machine/device)

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.Common;
using System.Windows.Media.Imaging;

namespace eIDCA.WinApp.ViewModels.CompanyOnboarding;

public partial class Step2SignatureViewModel : ObservableObject
{
    private readonly CompanyOnboardingState _state;
    private readonly EidcaApiService        _api;
    private          IDeviceService         _device;
    private          TaskCompletionSource<AaResponseEventArgs>? _aaTcs;

    public CodePanelViewModel CodePanel { get; } = new() { RequestTitle = "POST /eid-company/signature" };

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SendSignatureCommand))]
    private bool _isActive = false;
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SendSignatureCommand))]
    private bool _isLoading = false;
    [ObservableProperty] private string       _statusMsg  = "";
    [ObservableProperty] private bool         _isDone     = false;
    [ObservableProperty] private bool         _hasRawData = false;
    [ObservableProperty] private string       _nfcSummary = "Chờ dữ liệu NFC...";
    [ObservableProperty] private BitmapSource? _selfieImage;
    [ObservableProperty] private string        _phone  = "";
    [ObservableProperty] private string        _email  = "";

    public event Action? OnDone;

    public Step2SignatureViewModel(CompanyOnboardingState state, EidcaApiService api, IDeviceService device)
    {
        _state  = state;
        _api    = api;
        _device = device;
        _device.AaResponseReceived += OnAaResponse;
    }

    public void Activate()
    {
        IsActive  = true;
        StatusMsg = HasRawData ? "✅ Dữ liệu NFC sẵn sàng. Nhấn 'Gửi Signature'."
                               : "⏳ Đang chờ dữ liệu NFC...";
    }

    public void SetRawData(RawNfcData rawData)
    {
        _state.RawData = rawData;
        HasRawData     = true;
        NfcSummary     = "✅ NFC data đã sẵn sàng";
        if (IsActive) StatusMsg = "✅ Nhấn 'Gửi Signature' để hoàn tất.";
    }

    public void SetSelfie(string base64)
    {
        _state.SelfieBase64 = base64;
        SelfieImage         = Base64ToBitmap(base64);
    }

    [RelayCommand]
    private async Task RetryNfcAsync()
    {
        HasRawData = false;
        NfcSummary = "Đang đọc thẻ...";
        await _device.SimulateCardReadAsync();
    }

    [RelayCommand(CanExecute = nameof(CanSend))]
    private async Task SendSignatureAsync()
    {
        if (_state.RawData is null)
        {
            StatusMsg = "❌ Chưa có dữ liệu NFC.";
            return;
        }

        IsLoading = true;
        StatusMsg = "🔐 Đang ký AA...";

        try
        {
            // SendAA dùng token_challenge (company không có "challenge" riêng)
            _aaTcs = new TaskCompletionSource<AaResponseEventArgs>();
            await _device.SendAAAsync(_state.TokenChallenge);
            var aa = await _aaTcs.Task.WaitAsync(TimeSpan.FromSeconds(10));
            _state.AaSignature = aa.AaSignature;

            StatusMsg = "📤 Đang gửi signature...";

            // info gọn hơn cá nhân: chỉ phone, email, image
            var info = new { phone = Phone, email = Email, image = _state.SelfieBase64 };

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

            var data = await _api.CompanySendSignatureAsync(
                _state.TransactionCode, _state.TokenChallenge,
                _state.RawData, info, _state.AaSignature);

            _state.TokenSignature = data.GetProperty("token_signature").GetString() ?? "";
            _state.Interval       = data.TryGetProperty("interval", out var iv)
                                  ? int.TryParse(iv.GetString(), out var ivN) ? ivN : 3000 : 3000;

            CodePanel.SetResponse(data, PanelState.Success);
            StatusMsg = "✅ Gửi thành công. Chờ cấp CTS...";
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

    private bool CanSend() => IsActive && !IsLoading;
    private void OnAaResponse(object? s, AaResponseEventArgs e) => _aaTcs?.TrySetResult(e);

    private static BitmapSource? Base64ToBitmap(string base64)
    {
        try
        {
            var bytes = Convert.FromBase64String(base64);
            using var ms = new System.IO.MemoryStream(bytes);
            var bmp = new BitmapImage();
            bmp.BeginInit(); bmp.StreamSource = ms; bmp.CacheOption = BitmapCacheOption.OnLoad; bmp.EndInit(); bmp.Freeze();
            return bmp;
        }
        catch { return null; }
    }
}
