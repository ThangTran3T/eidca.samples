// Services/MockDeviceService.cs
// Giả lập NFC Reader + Webcam — tương đương mockSocket.js trong web-app.
// Timing giống hệt: NFC +600ms, Webcam +800ms, cards sequence, AA +500ms.

using eIDCA.WinApp.Core;

namespace eIDCA.WinApp.Services;

public class MockDeviceService : IDeviceService
{
    private bool _nfcConnected;
    private bool _camConnected;
    private CancellationTokenSource? _camCts;
    private readonly List<CancellationTokenSource> _cardTimers = [];

    // ── IDeviceService Events ─────────────────────────────────────────────────
    public event EventHandler?                   NfcConnected;
    public event EventHandler?                   NfcDisconnected;
    public event EventHandler<DeviceInfoEventArgs>?   DeviceInfoReceived;
    public event EventHandler<PersonalInfoEventArgs>? PersonalInfoReceived;
    public event EventHandler<AvatarImageEventArgs>?  AvatarImageReceived;
    public event EventHandler<DsCertEventArgs>?       DsCertReceived;
    public event EventHandler<CardErrorEventArgs>?    CardErrorReceived;
    public event EventHandler<AaResponseEventArgs>?   AaResponseReceived;
    public event EventHandler?                   CamConnected;
    public event EventHandler?                   CamDisconnected;
    public event EventHandler<WebcamFrameEventArgs>?  WebcamFrameReceived;

    public bool IsNfcConnected => _nfcConnected;
    public bool IsCamConnected => _camConnected;

    // ── Connect ───────────────────────────────────────────────────────────────
    public async Task ConnectAsync()
    {
        // NFC ready sau 600ms
        _ = Task.Run(async () =>
        {
            await Task.Delay(600);
            _nfcConnected = true;
            Dispatch(() => NfcConnected?.Invoke(this, EventArgs.Empty));
            Dispatch(() => DeviceInfoReceived?.Invoke(this, new DeviceInfoEventArgs(MockData.DeviceInfo)));
            await SimulateCardReadAsync(); // Tự động giả lập đặt thẻ
        });

        // Webcam ready sau 800ms
        _ = Task.Run(async () =>
        {
            await Task.Delay(800);
            StartWebcam();
        });

        await Task.CompletedTask;
    }

    // ── Disconnect ────────────────────────────────────────────────────────────
    public async Task DisconnectAsync()
    {
        _nfcConnected = false;
        foreach (var cts in _cardTimers) cts.Cancel();
        _cardTimers.Clear();
        StopWebcam();
        Dispatch(() => NfcDisconnected?.Invoke(this, EventArgs.Empty));
        await Task.CompletedTask;
    }

    // ── SendAA ────────────────────────────────────────────────────────────────
    public async Task SendAAAsync(string challenge)
    {
        // Giả lập chip ký sau 500ms
        await Task.Delay(500);
        var sig = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"MOCK_AA_SIG_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"));
        Dispatch(() => AaResponseReceived?.Invoke(this, new AaResponseEventArgs(sig, challenge)));
    }

    // ── SendReRead ────────────────────────────────────────────────────────────
    public async Task SendReReadAsync(string idCode, string dateOfBirth, string expiryDate)
    {
        // Re-read giả lập: gửi lại dữ liệu thẻ như mới đặt thẻ
        await SimulateCardReadAsync();
    }

    // ── SimulateCardRead ──────────────────────────────────────────────────────
    /// <summary>
    /// Giả lập đọc thẻ: id:2 → id:4 → id:5 với delay giữa các bước.
    /// Tương đương _simulateCardRead() trong mockSocket.js.
    /// </summary>
    public async Task SimulateCardReadAsync()
    {
        var cts = new CancellationTokenSource();
        _cardTimers.Add(cts);

        try
        {
            // Bước 1: thông tin text (id:2) sau 800ms
            await Task.Delay(800, cts.Token);
            Dispatch(() => PersonalInfoReceived?.Invoke(this, new PersonalInfoEventArgs(MockData.PersonalInfo)));

            // Bước 2: ảnh + raw NFC (id:4) sau thêm 600ms
            await Task.Delay(600, cts.Token);
            Dispatch(() => AvatarImageReceived?.Invoke(this, new AvatarImageEventArgs(MockData.AvatarImage)));

            // Bước 3: DS_CERT (id:5) sau thêm 400ms
            await Task.Delay(400, cts.Token);
            Dispatch(() => DsCertReceived?.Invoke(this, new DsCertEventArgs(MockData.DsCert)));
        }
        catch (TaskCanceledException) { /* Bị cancel khi disconnect */ }
        finally
        {
            _cardTimers.Remove(cts);
            cts.Dispose();
        }
    }

    // ── Webcam ────────────────────────────────────────────────────────────────
    public void PauseCam() => StopWebcam();

    public void ResumeCam()
    {
        if (!_camConnected) StartWebcam();
    }

    private void StartWebcam()
    {
        _camCts = new CancellationTokenSource();
        var token = _camCts.Token;
        _camConnected = true;
        Dispatch(() => CamConnected?.Invoke(this, EventArgs.Empty));

        // Stream 5fps (200ms interval)
        _ = Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(200, token);
                    Dispatch(() => WebcamFrameReceived?.Invoke(this,
                        new WebcamFrameEventArgs(MockData.PlaceholderImageBase64)));
                }
                catch (TaskCanceledException) { break; }
            }
        }, token);
    }

    private void StopWebcam()
    {
        _camCts?.Cancel();
        _camCts = null;
        if (_camConnected)
        {
            _camConnected = false;
            Dispatch(() => CamDisconnected?.Invoke(this, EventArgs.Empty));
        }
    }

    // ── Helper: dispatch lên UI thread ────────────────────────────────────────
    private static void Dispatch(Action action)
    {
        if (System.Windows.Application.Current?.Dispatcher is { } dispatcher)
            dispatcher.Invoke(action);
        else
            action();
    }

    public void Dispose()
    {
        DisconnectAsync().GetAwaiter().GetResult();
    }
}
