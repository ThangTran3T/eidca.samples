// ViewModels/ModeToggleViewModel.cs
// Toggle Mock/Live mode và config Live API — tương đương ModeToggle.js trong web-app.

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Core;

namespace eIDCA.WinApp.ViewModels;

public partial class ModeToggleViewModel : ObservableObject
{
    private readonly AppConfig _config;

    /// <summary>Callback khi user apply config mới → MainWindowViewModel rebuild service</summary>
    public event Action<AppConfig>? OnConfigChanged;

    [ObservableProperty] private bool   _isMock = true;
    [ObservableProperty] private string _liveApiBaseUrl  = "";
    [ObservableProperty] private string _liveApiKey      = "";
    [ObservableProperty] private string _livePartnerCode = "";

    // Mock mode: readonly display
    public string MockApiUrl => _config.MockApiBaseUrl;

    // Panel visibility
    public bool ShowMockPanel => IsMock;
    public bool ShowLivePanel => !IsMock;

    public ModeToggleViewModel(AppConfig config)
    {
        _config         = config;
        _isMock         = config.IsMock;
        _liveApiBaseUrl  = config.LiveApiBaseUrl;
        _liveApiKey      = config.LiveApiKey;
        _livePartnerCode = config.LivePartnerCode;
    }

    partial void OnIsMockChanged(bool value)
    {
        OnPropertyChanged(nameof(ShowMockPanel));
        OnPropertyChanged(nameof(ShowLivePanel));
        // Apply ngay khi toggle
        ApplyConfig();
    }

    [RelayCommand]
    private void ApplyConfig()
    {
        _config.IsMock          = IsMock;
        _config.LiveApiBaseUrl  = LiveApiBaseUrl;
        _config.LiveApiKey      = LiveApiKey;
        _config.LivePartnerCode = LivePartnerCode;

        OnConfigChanged?.Invoke(_config);
    }
}
