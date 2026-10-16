// ViewModels/PersonalOnboarding/PersonalOnboardingViewModel.cs
// Điều phối 3 bước luồng Đăng ký CTS Cá nhân — tương đương mountPersonalOnboarding() trong index.js

using CommunityToolkit.Mvvm.ComponentModel;
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;

namespace eIDCA.WinApp.ViewModels.PersonalOnboarding;

public partial class PersonalOnboardingViewModel : ObservableObject
{
    private readonly PersonalOnboardingState _state;
    private readonly IDeviceService           _device;

    public Step1ChallengeViewModel Step1 { get; }
    public Step2SignatureViewModel  Step2 { get; }
    public Step3CheckViewModel      Step3 { get; }

    // Stepper: 0=step1 active, 1=step2 active, 2=step3 active, 3=done
    [ObservableProperty] private int _currentStep = 0;

    public PersonalOnboardingViewModel(AppConfig config, IDeviceService device, EidcaApiService api)
    {
        _device = device;
        _state  = new PersonalOnboardingState { PartnerCode = config.PartnerCode };

        Step1 = new Step1ChallengeViewModel(_state, api);
        Step2 = new Step2SignatureViewModel(_state, api, device);
        Step3 = new Step3CheckViewModel(_state, api);

        // Wire step transitions
        Step1.OnDone += () =>
        {
            CurrentStep = 1;

            // Nếu đã có selfie → set vào step2
            if (!string.IsNullOrEmpty(_state.SelfieBase64))
                Step2.SetSelfie(_state.SelfieBase64);

            Step2.Activate();

            // Nếu đã có rawData → set vào step2 (đọc thẻ trước khi bấm step1)
            if (_state.RawData is not null)
                Step2.SetRawData(_state.RawData);
        };

        Step2.OnDone += () =>
        {
            CurrentStep = 2;
            Step3.Activate();
        };

        Step3.OnDone += () => CurrentStep = 3;

        // Subscribe device events — chain pattern (giống web-app)
        SubscribeDeviceEvents();
    }

    private void SubscribeDeviceEvents()
    {
        // NFC personalInfo (id:2) → điền id_number vào Step1
        _device.PersonalInfoReceived += (_, e) =>
        {
            _state.IdNumber = e.Data.IdCode;
            Step1.SetIdFromCard(e.Data.IdCode);
        };

        // NFC avatarImage (id:4) → lưu rawData cho Step2
        _device.AvatarImageReceived += (_, e) =>
        {
            var raw = new RawNfcData(e.Data.Sod, e.Data.Dg1, e.Data.Dg2, e.Data.Dg13, e.Data.Dg15);
            _state.RawData = raw;
            Step2.SetRawData(raw);
        };

        // Webcam frame → chỉ lấy frame đầu tiên làm selfie
        bool selfieSet = false;
        _device.WebcamFrameReceived += (_, e) =>
        {
            if (selfieSet || string.IsNullOrEmpty(e.Base64)) return;
            selfieSet           = true;
            _state.SelfieBase64 = e.Base64;
            Step2.SetSelfie(e.Base64);
        };

        // DeviceInfo → lưu device info vào state
        _device.DeviceInfoReceived += (_, e) =>
        {
            _state.DeviceInfo = e.Info;
        };
    }
}
