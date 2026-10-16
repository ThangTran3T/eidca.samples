// ViewModels/CompanyOnboarding/CompanyOnboardingViewModel.cs

using CommunityToolkit.Mvvm.ComponentModel;
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;

namespace eIDCA.WinApp.ViewModels.CompanyOnboarding;

public partial class CompanyOnboardingViewModel : ObservableObject
{
    private readonly CompanyOnboardingState _state;
    private readonly IDeviceService          _device;

    public Step1ChallengeViewModel Step1 { get; }
    public Step2SignatureViewModel Step2 { get; }
    public Step3CheckViewModel Step3 { get; }

    [ObservableProperty] private int _currentStep = 0;

    public CompanyOnboardingViewModel(AppConfig config, IDeviceService device, EidcaApiService api)
    {
        _device = device;
        _state  = new CompanyOnboardingState { PartnerCode = config.PartnerCode };

        Step1 = new Step1ChallengeViewModel(_state, api);
        Step2 = new Step2SignatureViewModel(_state, api, device);
        Step3 = new Step3CheckViewModel(_state, api);

        Step1.OnDone += () =>
        {
            CurrentStep = 1;
            if (!string.IsNullOrEmpty(_state.SelfieBase64)) Step2.SetSelfie(_state.SelfieBase64);
            Step2.Activate();
            if (_state.RawData is not null) Step2.SetRawData(_state.RawData);
        };

        Step2.OnDone += () => { CurrentStep = 2; Step3.Activate(); };
        Step3.OnDone += () => CurrentStep = 3;

        SubscribeDeviceEvents();
    }

    private void SubscribeDeviceEvents()
    {
        _device.PersonalInfoReceived += (_, e) =>
        {
            _state.IdNumber = e.Data.IdCode;
            Step1.SetIdFromCard(e.Data.IdCode);
        };

        _device.AvatarImageReceived += (_, e) =>
        {
            var raw = new RawNfcData(e.Data.Sod, e.Data.Dg1, e.Data.Dg2, e.Data.Dg13, e.Data.Dg15);
            _state.RawData = raw;
            Step2.SetRawData(raw);
        };

        bool selfieSet = false;
        _device.WebcamFrameReceived += (_, e) =>
        {
            if (selfieSet || string.IsNullOrEmpty(e.Base64)) return;
            selfieSet = true;
            _state.SelfieBase64 = e.Base64;
            Step2.SetSelfie(e.Base64);
        };

        _device.DeviceInfoReceived += (_, e) => _state.DeviceInfo = e.Info;
    }
}
