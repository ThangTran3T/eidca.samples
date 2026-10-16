// ViewModels/Common/CodePanelViewModel.cs
// Hiển thị JSON Request/Response song song — tương đương CodePanel.js trong web-app.

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Text.Json;
using System.Windows;

namespace eIDCA.WinApp.ViewModels.Common;

public enum PanelState { Idle, Loading, Success, Error, Processing }

public partial class CodePanelViewModel : ObservableObject
{
    [ObservableProperty] private string _requestTitle  = "Request";
    [ObservableProperty] private string _responseTitle = "Response";
    [ObservableProperty] private string _requestJson   = "";
    [ObservableProperty] private string _responseJson  = "";
    [ObservableProperty] private PanelState _state     = PanelState.Idle;

    public string StateLabel => State switch
    {
        PanelState.Loading    => "⏳ Loading...",
        PanelState.Success    => "✅ Success",
        PanelState.Error      => "❌ Error",
        PanelState.Processing => "🔄 Processing...",
        _                     => "",
    };

    public void SetRequest(object? obj)
    {
        RequestJson = obj is null ? "" : JsonSerializer.Serialize(obj, new JsonSerializerOptions { WriteIndented = true });
    }

    public void SetResponse(object? obj, PanelState state = PanelState.Success)
    {
        ResponseJson = obj is null ? "" : JsonSerializer.Serialize(obj, new JsonSerializerOptions { WriteIndented = true });
        State        = state;
        OnPropertyChanged(nameof(StateLabel));
    }

    public void SetLoading()
    {
        ResponseJson = "...";
        State        = PanelState.Loading;
        OnPropertyChanged(nameof(StateLabel));
    }

    public void SetError(string message)
    {
        ResponseJson = JsonSerializer.Serialize(new { error = message }, new JsonSerializerOptions { WriteIndented = true });
        State        = PanelState.Error;
        OnPropertyChanged(nameof(StateLabel));
    }

    [RelayCommand]
    private void CopyRequest()
    {
        if (!string.IsNullOrEmpty(RequestJson))
            Clipboard.SetText(RequestJson);
    }

    [RelayCommand]
    private void CopyResponse()
    {
        if (!string.IsNullOrEmpty(ResponseJson))
            Clipboard.SetText(ResponseJson);
    }
}
