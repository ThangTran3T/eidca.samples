// ViewModels/DevicePanelViewModel.cs
// Sidebar: NFC status, Webcam preview, Card info.
// Tương đương DevicePanel.js trong web-app.

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;
using System.Windows.Media.Imaging;

namespace eIDCA.WinApp.ViewModels;

public partial class DevicePanelViewModel : ObservableObject
{
    private IDeviceService _device;
    private string? _currentFrameBase64;
    private bool _camPaused;

    // ── NFC Status ────────────────────────────────────────────────────────────
    [ObservableProperty] private string _nfcStatusLabel = "Chưa kết nối";
    [ObservableProperty] private string _nfcStatusDot   = "🔴";   // 🔴 grey | 🟡 connecting | 🟢 connected
    [ObservableProperty] private string _nfcSerial      = "";
    [ObservableProperty] private string _cardName        = "";
    [ObservableProperty] private string _cardId          = "";

    // ── Webcam Status ─────────────────────────────────────────────────────────
    [ObservableProperty] private string _camStatusLabel = "Chưa kết nối";
    [ObservableProperty] private string _camStatusDot   = "🔴";
    [ObservableProperty] private BitmapSource? _webcamFrame;

    // ── Mode Badge ────────────────────────────────────────────────────────────
    [ObservableProperty] private bool _isMock = true;
    public string ModeBadge => IsMock ? "🟡 Mock" : "🟢 Live";

    // ── Selfie ────────────────────────────────────────────────────────────────
    /// <summary>Base64 frame mới nhất — dùng để chụp selfie</summary>
    public string? CurrentFrame => _currentFrameBase64;

    public DevicePanelViewModel(IDeviceService device)
    {
        _device = device;
        SubscribeToDevice(device);
    }

    // ── Public Methods ────────────────────────────────────────────────────────

    public void UpdateDevice(IDeviceService newDevice)
    {
        UnsubscribeFromDevice(_device);
        _device = newDevice;
        SubscribeToDevice(newDevice);

        // Reset UI
        NfcStatusLabel = "Đang kết nối...";
        NfcStatusDot   = "🟡";
        CamStatusLabel = "Đang kết nối...";
        CamStatusDot   = "🟡";
        CardName       = "";
        CardId         = "";
        WebcamFrame    = null;
        _currentFrameBase64 = null;
        _camPaused     = false;
    }

    public void SetMode(bool isMock)
    {
        IsMock = isMock;
        OnPropertyChanged(nameof(ModeBadge));
    }

    [RelayCommand]
    public void PauseCam()
    {
        _camPaused = true;
        _device.PauseCam();
    }

    [RelayCommand]
    public void ResumeCam()
    {
        _camPaused          = false;
        _currentFrameBase64 = null;  // Clear frame cũ
        WebcamFrame         = null;
        _device.ResumeCam();
    }

    // ── Device event subscriptions ────────────────────────────────────────────

    private void SubscribeToDevice(IDeviceService device)
    {
        device.NfcConnected       += OnNfcConnected;
        device.NfcDisconnected    += OnNfcDisconnected;
        device.DeviceInfoReceived += OnDeviceInfo;
        device.PersonalInfoReceived += OnPersonalInfo;
        device.CamConnected       += OnCamConnected;
        device.CamDisconnected    += OnCamDisconnected;
        device.WebcamFrameReceived += OnWebcamFrame;
    }

    private void UnsubscribeFromDevice(IDeviceService device)
    {
        device.NfcConnected       -= OnNfcConnected;
        device.NfcDisconnected    -= OnNfcDisconnected;
        device.DeviceInfoReceived -= OnDeviceInfo;
        device.PersonalInfoReceived -= OnPersonalInfo;
        device.CamConnected       -= OnCamConnected;
        device.CamDisconnected    -= OnCamDisconnected;
        device.WebcamFrameReceived -= OnWebcamFrame;
    }

    private void OnNfcConnected(object? s, EventArgs e)
    {
        NfcStatusLabel = "Đã kết nối";
        NfcStatusDot   = "🟢";
    }

    private void OnNfcDisconnected(object? s, EventArgs e)
    {
        NfcStatusLabel = "Mất kết nối";
        NfcStatusDot   = "🔴";
        NfcSerial      = "";
    }

    private void OnDeviceInfo(object? s, DeviceInfoEventArgs e)
    {
        NfcSerial = e.Info.SerialNfc;
    }

    private void OnPersonalInfo(object? s, PersonalInfoEventArgs e)
    {
        CardName = e.Data.PersonName;
        CardId   = e.Data.IdCode;
    }

    private void OnCamConnected(object? s, EventArgs e)
    {
        CamStatusLabel = "Đã kết nối";
        CamStatusDot   = "🟢";
    }

    private void OnCamDisconnected(object? s, EventArgs e)
    {
        CamStatusLabel = "Mất kết nối";
        CamStatusDot   = "🔴";
    }

    private void OnWebcamFrame(object? s, WebcamFrameEventArgs e)
    {
        if (_camPaused) return;

        _currentFrameBase64 = e.Base64;

        // Convert Base64 → BitmapSource để hiển thị trên Image control
        try
        {
            var bytes   = Convert.FromBase64String(e.Base64);
            using var ms = new System.IO.MemoryStream(bytes);
            var bitmap  = new BitmapImage();
            bitmap.BeginInit();
            bitmap.StreamSource    = ms;
            bitmap.CacheOption     = BitmapCacheOption.OnLoad;
            bitmap.EndInit();
            bitmap.Freeze(); // Thread-safe
            WebcamFrame = bitmap;
        }
        catch { /* Ignore malformed frame */ }
    }
}
