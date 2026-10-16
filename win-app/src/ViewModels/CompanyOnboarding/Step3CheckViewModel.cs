// ViewModels/CompanyOnboarding/Step3CheckViewModel.cs
// POST /ca/api/eid-company/check

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.Common;
using System.Text.Json;

namespace eIDCA.WinApp.ViewModels.CompanyOnboarding;

public partial class Step3CheckViewModel : ObservableObject
{
    private readonly CompanyOnboardingState _state;
    private readonly EidcaApiService        _api;
    private          CancellationTokenSource? _pollCts;

    public CodePanelViewModel CodePanel { get; } = new() { RequestTitle = "POST /eid-company/check" };

    [ObservableProperty] private bool   _isActive   = false;
    [ObservableProperty] private bool   _isPolling  = false;
    [ObservableProperty] private string _statusMsg  = "";
    [ObservableProperty] private string _certInfo   = "";
    [ObservableProperty] private bool   _isDone     = false;
    [ObservableProperty] private int    _pollCount  = 0;

    public event Action? OnDone;

    public Step3CheckViewModel(CompanyOnboardingState state, EidcaApiService api)
    {
        _state = state;
        _api   = api;
    }

    public void Activate()
    {
        IsActive  = true;
        StatusMsg = "🔄 Đang kiểm tra trạng thái cấp CTS Tổ chức...";
        _ = StartPollingAsync();
    }

    [RelayCommand]
    private async Task RetryAsync()
    {
        _pollCts?.Cancel();
        PollCount = 0;
        IsDone    = false;
        CertInfo  = "";
        await StartPollingAsync();
    }

    private async Task StartPollingAsync()
    {
        _pollCts = new CancellationTokenSource();
        var token  = _pollCts.Token;
        IsPolling  = true;
        var interval  = _state.Interval > 0 ? _state.Interval : 3000;

        try
        {
            while (PollCount < 100 && !token.IsCancellationRequested)
            {
                PollCount++;
                StatusMsg = $"🔄 Kiểm tra lần {PollCount}/100...";

                CodePanel.SetRequest(new { code = _state.PartnerCode, transaction_code = _state.TransactionCode, token_signature = _state.TokenSignature });

                try
                {
                    var data   = await _api.CompanyCheckStatusAsync(_state.TransactionCode, _state.TokenSignature);
                    var status = data.TryGetProperty("status", out var s) ? s.GetString() ?? "" : "";

                    CodePanel.SetResponse(data, status == "completed" ? PanelState.Success : status == "failed" ? PanelState.Error : PanelState.Processing);

                    if (status == "completed")
                    {
                        StatusMsg = "✅ Cấp CTS Tổ chức thành công!";
                        if (data.TryGetProperty("cert_info", out var ci))
                            CertInfo = JsonSerializer.Serialize(ci, new JsonSerializerOptions { WriteIndented = true });
                        IsDone = true;
                        OnDone?.Invoke();
                        return;
                    }
                    if (status == "failed") { StatusMsg = "❌ Cấp CTS thất bại."; return; }
                }
                catch (Exception ex) { StatusMsg = $"⚠️ Poll lỗi: {ex.Message}"; }

                await Task.Delay(interval, token);
            }
            StatusMsg = "⏱️ Hết thời gian chờ. Nhấn Retry.";
        }
        catch (TaskCanceledException) { StatusMsg = "⏹️ Đã dừng polling."; }
        finally { IsPolling = false; _pollCts?.Dispose(); _pollCts = null; }
    }
}
