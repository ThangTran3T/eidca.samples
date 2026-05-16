// ViewModels/PersonalOnboarding/Step1ChallengeViewModel.cs
// STEP 1: Lấy challenge từ CCCD số — POST /ca/api/eid-personal/challenge

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.Common;

namespace eIDCA.WinApp.ViewModels.PersonalOnboarding;

public partial class Step1ChallengeViewModel : ObservableObject
{
    private readonly PersonalOnboardingState _state;
    private readonly EidcaApiService _api;
    public CodePanelViewModel CodePanel { get; } = new() { RequestTitle = "POST /eid-personal/challenge" };

    [ObservableProperty] private string _idNumber  = "";
    [ObservableProperty]
    private bool _isLoading = false;
    [ObservableProperty] private string _statusMsg = "";
    [ObservableProperty] private bool   _isDone    = false;

    public event Action? OnDone;

    public Step1ChallengeViewModel(PersonalOnboardingState state, EidcaApiService api)
    {
        _state = state;
        _api   = api;
    }

    /// <summary>Được gọi từ DevicePanel khi NFC đọc thẻ → tự điền IdNumber</summary>
    public void SetIdFromCard(string idCode)
    {
        IdNumber = idCode;
        _state.IdNumber = idCode;
    }

    [RelayCommand(CanExecute = nameof(CanGetChallenge))]
    private async Task GetChallengeAsync()
    {
        if (string.IsNullOrWhiteSpace(IdNumber))
        {
            StatusMsg = "❌ Vui lòng nhập số CCCD";
            return;
        }

        IsLoading = true;
        StatusMsg = "";
        CodePanel.SetRequest(new { code = _state.PartnerCode, id_number = IdNumber });
        CodePanel.SetLoading();

        try
        {
            _state.IdNumber = IdNumber;
            var data = await _api.PersonalGetChallengeAsync(IdNumber);

            _state.TransactionCode = data.GetProperty("transaction_code").GetString() ?? "";
            _state.Challenge       = data.TryGetProperty("challenge",      out var c) ? c.GetString() ?? "" : "";
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
