// ViewModels/MainWindowViewModel.cs
// Shell: tab navigation, mode toggle, socket lifecycle.
// Tương đương bootstrap() + router trong main.js

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.CompanyOnboarding;
using eIDCA.WinApp.ViewModels.CompanySign;
using eIDCA.WinApp.ViewModels.PersonalOnboarding;
using eIDCA.WinApp.ViewModels.PersonalSign;

namespace eIDCA.WinApp.ViewModels;

public partial class MainWindowViewModel : ObservableObject
{
    private readonly AppConfig       _config;
    private          IDeviceService  _device;
    private readonly EidcaApiService _api;

    public DevicePanelViewModel DevicePanel { get; private set; }
    public ModeToggleViewModel  ModeToggle  { get; private set; }

    // ── Tab content ViewModels ─────────────────────────────────────────────────
    [ObservableProperty] private object? _currentFlow;
    [ObservableProperty] private int     _selectedTabIndex = 0;

    // ── Flows (recreated on mode change) ─────────────────────────────────────
    private PersonalOnboardingViewModel? _personalOnboarding;
    private PersonalSignViewModel?       _personalSign;
    private CompanyOnboardingViewModel?  _companyOnboarding;
    private CompanySignViewModel?        _companySign;

    public MainWindowViewModel(AppConfig config, EidcaApiService api)
    {
        _config = config;
        _api    = api;
        _device = config.IsMock ? new MockDeviceService() : new SocketDeviceService(config);

        DevicePanel = new DevicePanelViewModel(_device);
        ModeToggle  = new ModeToggleViewModel(config);

        ModeToggle.OnConfigChanged += OnModeChanged;

        // Kết nối device
        _ = _device.ConnectAsync();

        // Load tab mặc định
        NavigateTo(0);
    }

    // ── Tab Navigation ────────────────────────────────────────────────────────

    partial void OnSelectedTabIndexChanged(int value) => NavigateTo(value);

    [RelayCommand]
    private void NavigateTo(int tabIndex)
    {
        SelectedTabIndex = tabIndex;
        CurrentFlow = tabIndex switch
        {
            0 => _personalOnboarding ??= new PersonalOnboardingViewModel(_config, _device, _api),
            1 => _personalSign       ??= new PersonalSignViewModel(_config, _device, _api),
            2 => _companyOnboarding  ??= new CompanyOnboardingViewModel(_config, _device, _api),
            3 => _companySign        ??= new CompanySignViewModel(_config, _device, _api),
            _ => null,
        };
    }

    // ── Mode Change ───────────────────────────────────────────────────────────

    private async void OnModeChanged(AppConfig newConfig)
    {
        // Disconnect + dispose old device
        await _device.DisconnectAsync();
        _device.Dispose();

        // Create new device service
        _device = newConfig.IsMock ? new MockDeviceService() : new SocketDeviceService(newConfig);
        DevicePanel.UpdateDevice(_device);
        DevicePanel.SetMode(newConfig.IsMock);

        // Reset all flow VMs (will recreate with new device on next navigate)
        _personalOnboarding = null;
        _personalSign       = null;
        _companyOnboarding  = null;
        _companySign        = null;

        // Kết nối device mới
        await _device.ConnectAsync();

        // Reload tab hiện tại
        NavigateTo(SelectedTabIndex);
    }
}
