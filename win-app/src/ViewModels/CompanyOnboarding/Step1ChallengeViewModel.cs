// ViewModels/CompanyOnboarding/Step1ChallengeViewModel.cs
// Endpoint: POST /ca/api/eid-company/challenge (thêm company_id)
// Lưu ý: Response KHÔNG có field "challenge" riêng — chỉ có token_challenge

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.Common;

namespace eIDCA.WinApp.ViewModels.CompanyOnboarding;

public partial class Step1ChallengeViewModel : ObservableObject
{
    private readonly CompanyOnboardingState _state;
    private readonly EidcaApiService _api;
    public CodePanelViewModel CodePanel { get; } = new() { RequestTitle = "POST /eid-company/challenge" };

    [ObservableProperty] private string _idNumber   = "";
    [ObservableProperty] private string _companyId  = "1";
    [ObservableProperty]
    private bool _isLoading = false;
    [ObservableProperty] private string _statusMsg  = "";
    [ObservableProperty] private bool   _isDone     = false;

    public event Action? OnDone;

    public Step1ChallengeViewModel(CompanyOnboardingState state, EidcaApiService api)
    {
        _state = state;
        _api   = api;
        _companyId = state.CompanyId.ToString();
    }

    public void SetIdFromCard(string idCode)
    {
        IdNumber = idCode;
        _state.IdNumber = idCode;
    }

    [RelayCommand(CanExecute = nameof(CanGetChallenge))]
    private async Task GetChallengeAsync()
    {
        if (string.IsNullOrWhiteSpace(IdNumber))  { StatusMsg = "❌ Nhập số CCCD"; return; }
        if (!int.TryParse(CompanyId, out var cid)) { StatusMsg = "❌ Company ID không hợp lệ"; return; }

        IsLoading          = true;
        _state.CompanyId   = cid;
        StatusMsg          = "📡 Đang lấy challenge...";

        CodePanel.SetRequest(new { code = _state.PartnerCode, id_number = IdNumber, company_id = cid });
        CodePanel.SetLoading();

        try
        {
            _state.IdNumber = IdNumber;
            var data = await _api.CompanyGetChallengeAsync(IdNumber, cid);

            _state.TransactionCode = data.GetProperty("transaction_code").GetString() ?? "";
            // /eid-company/challenge không trả về "challenge" riêng
            _state.TokenChallenge  = data.GetProperty("token_challenge").GetString() ?? "";

            CodePanel.SetResponse(data, PanelState.Success);
            StatusMsg = "✅ Lấy Challenge thành công";
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
        }
    }

    private bool CanGetChallenge() => !IsLoading;
}
