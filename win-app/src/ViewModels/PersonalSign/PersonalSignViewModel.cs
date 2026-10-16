// ViewModels/PersonalSign/PersonalSignViewModel.cs
// Điều phối 3 bước luồng Ký số Cá nhân — tương đương mountPersonalSign() trong index.js

using CommunityToolkit.Mvvm.ComponentModel;
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;

namespace eIDCA.WinApp.ViewModels.PersonalSign;

public partial class PersonalSignViewModel : ObservableObject
{
    private readonly PersonalSignState _state;
    private readonly IDeviceService    _device;

    public Step1UploadViewModel Step1 { get; }
    public Step2SignatureViewModel Step2 { get; }
    public Step3DownloadViewModel Step3 { get; }

    [ObservableProperty] private int _currentStep = 0;

    public PersonalSignViewModel(AppConfig config, IDeviceService device, EidcaApiService api)
    {
        _device = device;
        _state  = new PersonalSignState { PartnerCode = config.PartnerCode, IsMock = config.IsMock };

        Step1 = new Step1UploadViewModel(_state, api);
        Step2 = new Step2SignatureViewModel(_state, api, device);
        Step3 = new Step3DownloadViewModel(
            () => _state.TransactionCode,
            () => _state.TokenSigned,
            () => _state.SignedDocs,
            api);

        Step1.OnDone += () =>
        {
            CurrentStep = 1;
            if (!string.IsNullOrEmpty(_state.SelfieBase64))
                Step2.SetSelfie(_state.SelfieBase64);
            Step2.Activate();
        };

        Step2.OnDone += () =>
        {
            CurrentStep = 2;
            Step3.Activate();
        };

        SubscribeDeviceEvents();
    }

    private void SubscribeDeviceEvents()
    {
        // personalInfo → điền id_number vào step1
        _device.PersonalInfoReceived += (_, e) =>
        {
            _state.IdNumber = e.Data.IdCode;
            Step1.SetIdFromCard(e.Data.IdCode);
        };

        // Webcam → chỉ lấy frame đầu tiên làm selfie
        bool selfieSet = false;
        _device.WebcamFrameReceived += (_, e) =>
        {
            if (selfieSet || string.IsNullOrEmpty(e.Base64)) return;
            selfieSet           = true;
            _state.SelfieBase64 = e.Base64;
            Step2.SetSelfie(e.Base64);
        };
    }
}
