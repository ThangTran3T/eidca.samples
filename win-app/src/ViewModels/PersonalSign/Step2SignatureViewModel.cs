// ViewModels/PersonalSign/Step2SignatureViewModel.cs
// STEP 2: AA ký doc_challenge + selfie → POST /ca/api/sign/signature
// Lưu ý: KHÔNG cần raw NFC data (sod/dg1/...) cho luồng ký số này.

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.Common;
using System.Windows.Media.Imaging;

namespace eIDCA.WinApp.ViewModels.PersonalSign;

public partial class Step2SignatureViewModel : ObservableObject
{
    private readonly PersonalSignState _state;
    private readonly EidcaApiService   _api;
    private          IDeviceService    _device;
    private          TaskCompletionSource<AaResponseEventArgs>? _aaTcs;

    public CodePanelViewModel CodePanel { get; } = new() { RequestTitle = "POST /sign/signature" };

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SignCommand))]
    private bool _isActive = false;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SignCommand))]
    private bool _isLoading = false;
    [ObservableProperty] private string       _statusMsg  = "";
    [ObservableProperty] private bool         _isDone     = false;
    [ObservableProperty] private BitmapSource? _selfieImage;

    public event Action? OnDone;

    public Step2SignatureViewModel(PersonalSignState state, EidcaApiService api, IDeviceService device)
    {
        _state  = state;
        _api    = api;
        _device = device;
        _device.AaResponseReceived += OnAaResponse;
    }

    public void Activate()
    {
        IsActive  = true;
        StatusMsg = "✅ Sẵn sàng ký. Nhấn 'Ký số' để tiếp tục.";
    }

    public void SetSelfie(string base64)
    {
        _state.SelfieBase64 = base64;
        SelfieImage         = Base64ToBitmap(base64);
    }

    [RelayCommand]
    public void RetakeSelfie()
    {
        _state.SelfieBase64 = "";
        SelfieImage         = null;
        _device.ResumeCam();
    }

    [RelayCommand(CanExecute = nameof(CanSign))]
    private async Task SignAsync()
    {
        if (!_state.Docs.Any())
        {
            StatusMsg = "❌ Không có tài liệu nào để ký.";
            return;
        }

        IsLoading = true;
        StatusMsg = "🔐 Đang ký AA trên chip thẻ...";

        try
        {
            // 1. SendAA với doc_challenge đầu tiên
            _aaTcs = new TaskCompletionSource<AaResponseEventArgs>();
            await _device.SendAAAsync(_state.Docs[0].DocChallenge);
            var aaResult   = await _aaTcs.Task.WaitAsync(TimeSpan.FromSeconds(10));
            _state.AaSignature = aaResult.AaSignature;

            StatusMsg = "📤 Đang gửi xác nhận ký lên server...";

            // 2. Build doc_signs
            var docSigns = _state.Docs.Select(d => new DocSign(d.DocId, _state.AaSignature)).ToList();

            var req = new
            {
                code             = _state.PartnerCode,
                transaction_code = _state.TransactionCode,
                token_sign       = _state.TokenSign,
                info             = new { image = _state.SelfieBase64 },
                doc_signs        = docSigns,
            };
            CodePanel.SetRequest(req);
            CodePanel.SetLoading();

            var data = await _api.SignSendSignatureAsync(
                _state.TransactionCode, _state.TokenSign, _state.SelfieBase64, docSigns);

            _state.TokenSigned = data.TryGetProperty("token", out var t) ? t.GetString() ?? "" : "";
            _state.SignedDocs  = ParseSignedDocs(data);

            CodePanel.SetResponse(data, PanelState.Success);
            StatusMsg = "✅ Ký thành công! Tiến hành download tài liệu.";
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

    private bool CanSign() => IsActive && !IsLoading;

    private void OnAaResponse(object? s, AaResponseEventArgs e) => _aaTcs?.TrySetResult(e);

    private static List<SignedDoc> ParseSignedDocs(System.Text.Json.JsonElement data)
    {
        var list = new List<SignedDoc>();
        if (!data.TryGetProperty("signed_docs", out var docs)) return list;
        foreach (var d in docs.EnumerateArray())
        {
            list.Add(new SignedDoc(
                d.TryGetProperty("doc_id",       out var id)  ? id.GetString()  ?? "" : "",
                d.TryGetProperty("doc_name",     out var nm)  ? nm.GetString()  ?? "" : "",
                d.TryGetProperty("ca_signature", out var cs)  ? cs.GetString()  ?? "" : "",
                d.TryGetProperty("sign_at",      out var sa)  ? sa.GetString()  ?? "" : "",
                d.TryGetProperty("doc_hash",     out var dh)  ? dh.GetString()  ?? "" : ""
            ));
        }
        return list;
    }

    private static BitmapSource? Base64ToBitmap(string base64)
    {
        try
        {
            var bytes = Convert.FromBase64String(base64);
            using var ms = new System.IO.MemoryStream(bytes);
            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.StreamSource = ms;
            bmp.CacheOption  = BitmapCacheOption.OnLoad;
            bmp.EndInit();
            bmp.Freeze();
            return bmp;
        }
        catch { return null; }
    }
}
