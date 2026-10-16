// Services/SocketDeviceService.cs
// Real SocketIO client — SocketIOClient v4 API.
// On() nhận Func<IEventContext, Task> (async).
// EmitAsync(eventName, IEnumerable<object> data).
// IEventContext.GetValue<T>(int index).

using eIDCA.WinApp.Core;
using SocketIOClient;
using SocketIOClient.Common;
using System.Text.Json;

namespace eIDCA.WinApp.Services;

public class SocketDeviceService : IDeviceService
{
    private readonly AppConfig _config;
    private SocketIOClient.SocketIO? _nfcSocket;
    private SocketIOClient.SocketIO? _camSocket;
    private readonly string _clientId = $"win_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

    public SocketDeviceService(AppConfig config) => _config = config;

    // ── Events ────────────────────────────────────────────────────────────────
    public event EventHandler?                       NfcConnected;
    public event EventHandler?                       NfcDisconnected;
    public event EventHandler<DeviceInfoEventArgs>?  DeviceInfoReceived;
    public event EventHandler<PersonalInfoEventArgs>? PersonalInfoReceived;
    public event EventHandler<AvatarImageEventArgs>? AvatarImageReceived;
    public event EventHandler<DsCertEventArgs>?      DsCertReceived;
    public event EventHandler<CardErrorEventArgs>?   CardErrorReceived;
    public event EventHandler<AaResponseEventArgs>?  AaResponseReceived;
    public event EventHandler?                       CamConnected;
    public event EventHandler?                       CamDisconnected;
    public event EventHandler<WebcamFrameEventArgs>? WebcamFrameReceived;

    public bool IsNfcConnected => _nfcSocket?.Connected ?? false;
    public bool IsCamConnected => _camSocket?.Connected ?? false;

    // ── Connect ───────────────────────────────────────────────────────────────
    public async Task ConnectAsync()
    {
        await ConnectNfcAsync();
        await ConnectCamAsync();
    }

    private async Task ConnectNfcAsync()
    {
        _nfcSocket = new SocketIOClient.SocketIO(new Uri(_config.SocketNfcUrl), new SocketIOOptions
        {
            ReconnectionAttempts = 5,
            ConnectionTimeout    = TimeSpan.FromSeconds(10),
        });

        _nfcSocket.OnConnected    += (_, _) => Dispatch(() => NfcConnected?.Invoke(this, EventArgs.Empty));
        _nfcSocket.OnDisconnected += (_, _) => Dispatch(() => NfcDisconnected?.Invoke(this, EventArgs.Empty));

        _nfcSocket.On("/info", async ctx =>
        {
            try
            {
                var raw  = ctx.GetValue<JsonElement>(0);
                var data = new DeviceInfoData
                {
                    Version      = SafeGet(raw, "version"),
                    SerialNfc    = SafeGet(raw, "serial_nfc"),
                    SerialDevice = SafeGet(raw, "serial_device"),
                    Date         = SafeGet(raw, "date"),
                };
                Dispatch(() => DeviceInfoReceived?.Invoke(this, new DeviceInfoEventArgs(data)));
            }
            catch (Exception ex) { Debug(ex); }
            await Task.CompletedTask;
        });

        _nfcSocket.On("/event", async ctx =>
        {
            try
            {
                var evt = ctx.GetValue<JsonElement>(0);
                switch (evt.GetProperty("id").GetInt32())
                {
                    case 2: HandlePersonalInfo(evt); break;
                    case 4: HandleAvatarImage(evt);  break;
                    case 5: HandleDsCert(evt);        break;
                    case 3: HandleCardError(evt);     break;
                    case 7: HandleAaResponse(evt);    break;
                }
            }
            catch (Exception ex) { Debug(ex); }
            await Task.CompletedTask;
        });

        await _nfcSocket.ConnectAsync();
    }

    private async Task ConnectCamAsync()
    {
        _camSocket = new SocketIOClient.SocketIO(new Uri(_config.SocketCamUrl), new SocketIOOptions
        {
            ReconnectionAttempts = 5,
            ConnectionTimeout    = TimeSpan.FromSeconds(10),
        });

        _camSocket.OnConnected    += (_, _) => Dispatch(() => CamConnected?.Invoke(this, EventArgs.Empty));
        _camSocket.OnDisconnected += (_, _) => Dispatch(() => CamDisconnected?.Invoke(this, EventArgs.Empty));

        _camSocket.On("/image", async ctx =>
        {
            try
            {
                var frame  = ctx.GetValue<JsonElement>(0);
                var base64 = frame.GetProperty("data").GetString() ?? "";
                Dispatch(() => WebcamFrameReceived?.Invoke(this, new WebcamFrameEventArgs(base64)));
            }
            catch { /* Ignore */ }
            await Task.CompletedTask;
        });

        await _camSocket.ConnectAsync();
    }

    // ── Disconnect ────────────────────────────────────────────────────────────
    public async Task DisconnectAsync()
    {
        if (_nfcSocket is not null) await _nfcSocket.DisconnectAsync();
        if (_camSocket is not null) await _camSocket.DisconnectAsync();
    }

    // ── SendAA ────────────────────────────────────────────────────────────────
    public async Task SendAAAsync(string challenge)
    {
        if (_nfcSocket?.Connected != true) return;
        await _nfcSocket.EmitAsync("/get_aa", new object[] { new { clientId = _clientId, challenge } });
    }

    // ── SendReRead ────────────────────────────────────────────────────────────
    public async Task SendReReadAsync(string idCode, string dateOfBirth, string expiryDate)
    {
        if (_nfcSocket?.Connected != true) return;
        await _nfcSocket.EmitAsync("/input_data", new object[] { new { idCode, dateOfBirth, expiryDate, clientId = _clientId } });
    }

    // ── Webcam ────────────────────────────────────────────────────────────────
    public void PauseCam()  { _ = _camSocket?.DisconnectAsync(); }
    public void ResumeCam() { if (_camSocket?.Connected == false) _ = _camSocket.ConnectAsync(); }

    // ── SimulateCardRead (no-op) ──────────────────────────────────────────────
    public Task SimulateCardReadAsync() => Task.CompletedTask;

    // ── Event Handlers ────────────────────────────────────────────────────────

    private void HandlePersonalInfo(JsonElement evt)
    {
        var d = evt.GetProperty("data");
        Dispatch(() => PersonalInfoReceived?.Invoke(this, new PersonalInfoEventArgs(new PersonalInfoData
        {
            IdCode      = SafeGet(d, "idCode"),
            PersonName  = SafeGet(d, "personName"),
            DateOfBirth = SafeGet(d, "dateOfBirth"),
            Gender      = SafeGet(d, "gender"),
            ExpiryDate  = SafeGet(d, "expiryDate"),
        })));
    }

    private void HandleAvatarImage(JsonElement evt)
    {
        var d = evt.GetProperty("data");
        Dispatch(() => AvatarImageReceived?.Invoke(this, new AvatarImageEventArgs(new AvatarImageData
        {
            ImgData = SafeGet(d, "img_data"),
            Dg1     = SafeGet(d, "dg1"),
            Dg2     = SafeGet(d, "dg2"),
            Dg13    = SafeGet(d, "dg13"),
            Dg14    = SafeGet(d, "dg14"),
            Dg15    = SafeGet(d, "dg15"),
            Sod     = SafeGet(d, "sod"),
        })));
    }

    private void HandleDsCert(JsonElement evt)
    {
        var d  = evt.GetProperty("data");
        var pa = d.GetProperty("PA");
        Dispatch(() => DsCertReceived?.Invoke(this, new DsCertEventArgs(new DsCertData
        {
            Ca = SafeGet(d, "CA"),
            Aa = new AaData { AaSignature = d.GetProperty("AA").GetProperty("aa_signature").GetString() },
            Pa = new PaData
            {
                HashDg1  = SafeGet(pa, "hash_dg1"),
                HashDg2  = SafeGet(pa, "hash_dg2"),
                HashDg13 = SafeGet(pa, "hash_dg13"),
                HashDg14 = SafeGet(pa, "hash_dg14"),
                HashDg15 = SafeGet(pa, "hash_dg15"),
                Cert     = SafeGet(pa, "cert"),
                Sod      = SafeGet(pa, "sod"),
            },
        })));
    }

    private void HandleCardError(JsonElement evt) =>
        Dispatch(() => CardErrorReceived?.Invoke(this, new CardErrorEventArgs(SafeGet(evt, "message"))));

    private void HandleAaResponse(JsonElement evt)
    {
        var d = evt.GetProperty("data");
        Dispatch(() => AaResponseReceived?.Invoke(this,
            new AaResponseEventArgs(SafeGet(d, "aa_signature"), SafeGet(d, "aa_challege"))));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private static string SafeGet(JsonElement el, string key)
    {
        if (el.TryGetProperty(key, out var p)) return p.GetString() ?? "";
        return "";
    }

    private static void Dispatch(Action a)
    {
        if (System.Windows.Application.Current?.Dispatcher is { } d) d.Invoke(a);
        else a();
    }

    private static void Debug(Exception ex) =>
        System.Diagnostics.Debug.WriteLine($"[Socket] {ex.Message}");

    public void Dispose() => DisconnectAsync().GetAwaiter().GetResult();
}
