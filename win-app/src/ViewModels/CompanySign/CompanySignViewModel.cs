// ViewModels/CompanySign/CompanySignViewModel.cs
// Step 3 dùng chung Step3DownloadViewModel từ PersonalSign

using CommunityToolkit.Mvvm.ComponentModel;
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.PersonalSign;

namespace eIDCA.WinApp.ViewModels.CompanySign;

public partial class CompanySignViewModel : ObservableObject
{
    private readonly CompanySignState _state;
    private readonly IDeviceService   _device;

    public Step1UploadViewModel Step1 { get; }
    public Step2SignatureViewModel Step2 { get; }
    public Step3DownloadViewModel Step3 { get; } // Dùng chung từ PersonalSign

    [ObservableProperty] private int _currentStep = 0;

    public CompanySignViewModel(AppConfig config, IDeviceService device, EidcaApiService api)
    {
        _device = device;
        _state  = new CompanySignState { PartnerCode = config.PartnerCode };

        Step1 = new Step1UploadViewModel(_state, api);
        Step2 = new Step2SignatureViewModel(_state, api, device);

        // Step3 dùng chung Step3DownloadViewModel — endpoint /sign/download/{doc-id} không đổi
        Step3 = new Step3DownloadViewModel(
            () => _state.TransactionCode,
            () => _state.TokenSigned,
            () => _state.SignedDocs,
            api);

        Step1.OnDone += () =>
        {
            CurrentStep = 1;
            if (!string.IsNullOrEmpty(_state.SelfieBase64)) Step2.SetSelfie(_state.SelfieBase64);
            Step2.Activate();
        };

        Step2.OnDone += () => { CurrentStep = 2; Step3.Activate(); };

        SubscribeDeviceEvents();
    }

    private void SubscribeDeviceEvents()
    {
        _device.PersonalInfoReceived += (_, e) =>
        {
            _state.IdNumber = e.Data.IdCode;
            Step1.SetIdFromCard(e.Data.IdCode);
        };

        bool selfieSet = false;
        _device.WebcamFrameReceived += (_, e) =>
        {
            if (selfieSet || string.IsNullOrEmpty(e.Base64)) return;
            selfieSet = true;
            _state.SelfieBase64 = e.Base64;
            Step2.SetSelfie(e.Base64);
        };
    }
}
