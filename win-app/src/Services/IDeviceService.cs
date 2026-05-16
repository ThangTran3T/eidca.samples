// Services/IDeviceService.cs
// Interface chung cho NFC Reader + Webcam.
// Tương đương với socket.on.* pattern trong web-app/src/socket/

using eIDCA.WinApp.Core;

namespace eIDCA.WinApp.Services;

// ── Event Args ────────────────────────────────────────────────────────────────

public class DeviceInfoEventArgs(DeviceInfoData info) : EventArgs
{
    public DeviceInfoData Info { get; } = info;
}

public class PersonalInfoEventArgs(PersonalInfoData data) : EventArgs
{
    public PersonalInfoData Data { get; } = data;
}

public class AvatarImageEventArgs(AvatarImageData data) : EventArgs
{
    public AvatarImageData Data { get; } = data;
}

public class DsCertEventArgs(DsCertData data) : EventArgs
{
    public DsCertData Data { get; } = data;
}

public class CardErrorEventArgs(string message) : EventArgs
{
    public string Message { get; } = message;
}

public class AaResponseEventArgs(string aaSignature, string aaChallenge) : EventArgs
{
    public string AaSignature { get; } = aaSignature;
    public string AaChallenge { get; } = aaChallenge;
}

public class WebcamFrameEventArgs(string base64Frame) : EventArgs
{
    /// <summary>Base64 JPEG frame từ webcam (~5fps)</summary>
    public string Base64 { get; } = base64Frame;
}

// ── Interface ─────────────────────────────────────────────────────────────────

/// <summary>
/// Interface chung cho NFC Reader + Webcam.
/// Implement bởi MockDeviceService và SocketDeviceService.
/// Cho phép swap mock/real mà không cần thay đổi ViewModel.
/// </summary>
public interface IDeviceService : IDisposable
{
    // ── NFC Events ────────────────────────────────────────────────────────────
    event EventHandler?                   NfcConnected;
    event EventHandler?                   NfcDisconnected;
    event EventHandler<DeviceInfoEventArgs>?   DeviceInfoReceived;
    event EventHandler<PersonalInfoEventArgs>? PersonalInfoReceived;
    event EventHandler<AvatarImageEventArgs>?  AvatarImageReceived;
    event EventHandler<DsCertEventArgs>?       DsCertReceived;
    event EventHandler<CardErrorEventArgs>?    CardErrorReceived;
    event EventHandler<AaResponseEventArgs>?   AaResponseReceived;

    // ── Webcam Events ─────────────────────────────────────────────────────────
    event EventHandler?                   CamConnected;
    event EventHandler?                   CamDisconnected;
    event EventHandler<WebcamFrameEventArgs>?  WebcamFrameReceived;

    // ── State ─────────────────────────────────────────────────────────────────
    bool IsNfcConnected { get; }
    bool IsCamConnected { get; }

    // ── Methods ───────────────────────────────────────────────────────────────
    Task ConnectAsync();
    Task DisconnectAsync();

    /// <summary>Ký Active Authentication — kết quả về qua AaResponseReceived</summary>
    Task SendAAAsync(string challenge);

    /// <summary>Re-read thẻ đang đặt trên đầu đọc</summary>
    Task SendReReadAsync(string idCode, string dateOfBirth, string expiryDate);

    void PauseCam();
    void ResumeCam();

    /// <summary>Chỉ MockDeviceService — trigger giả lập đọc thẻ thủ công</summary>
    Task SimulateCardReadAsync();
}
