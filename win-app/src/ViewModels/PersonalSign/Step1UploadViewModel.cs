// ViewModels/PersonalSign/Step1UploadViewModel.cs
// STEP 1: Upload PDF + id_number → POST /ca/api/sign/challenge (multipart)

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.Common;
using Microsoft.Win32;
using System.Text.Json;

namespace eIDCA.WinApp.ViewModels.PersonalSign;

public partial class Step1UploadViewModel : ObservableObject
{
    private readonly PersonalSignState _state;
    private readonly EidcaApiService   _api;

    public CodePanelViewModel CodePanel { get; } = new() { RequestTitle = "POST /sign/challenge" };

    // Default sign_props — hardcode mẫu hợp lệ cho demo
    private const string DefaultSignProps =
        "[{\"page\":1,\"lLx\":65,\"lLy\":320,\"width\":260,\"height\":90," +
        "\"template\":\"text_only\",\"show_info\":[\"reason\",\"location\",\"contact\",\"name\",\"org\",\"date\"]," +
        "\"location\":\"Ha Noi\",\"location_label\":\"Tai: Phong giao dich\"," +
        "\"reason\":\"Ky tai lieu\",\"reason_label\":\"\"," +
        "\"contact\":\"Nguoi ky\",\"contact_label\":\"Email: info@eidca.vn\"," +
        "\"date_label\":\"Ngay ky\",\"text_color\":\"#0000ff\",\"font_size\":11," +
        "\"sign_visibility\":\"shown\",\"watermark_pos\":\"center\"," +
        "\"watermark_img_b64\":\"\",\"hand_sig_img_b64\":\"\"}]";

    [ObservableProperty] private string _idNumber      = "";
    [ObservableProperty] private string _selectedFileName = "Chưa chọn file...";
    [ObservableProperty]
    private bool _isLoading = false;
    [ObservableProperty] private string _statusMsg     = "";
    [ObservableProperty] private string _docsInfo      = "";
    [ObservableProperty] private bool   _isDone        = false;

    public event Action? OnDone;

    public Step1UploadViewModel(PersonalSignState state, EidcaApiService api)
    {
        _state = state;
        _api   = api;
    }

    public void SetIdFromCard(string idCode)
    {
        IdNumber = idCode;
        _state.IdNumber = idCode;
    }

    [RelayCommand]
    private void BrowseFile()
    {
        var dlg = new OpenFileDialog
        {
            Title  = "Chọn tài liệu cần ký",
            Filter = "PDF files (*.pdf)|*.pdf|All files (*.*)|*.*",
        };
        if (dlg.ShowDialog() == true)
        {
            _state.SelectedFilePath = dlg.FileName;
            SelectedFileName        = System.IO.Path.GetFileName(dlg.FileName);
        }
    }

    [RelayCommand(CanExecute = nameof(CanUpload))]
    private async Task UploadAsync()
    {
        if (string.IsNullOrEmpty(_state.SelectedFilePath))
        {
            StatusMsg = "❌ Vui lòng chọn file PDF";
            return;
        }
        if (string.IsNullOrWhiteSpace(IdNumber))
        {
            StatusMsg = "❌ Vui lòng nhập số CCCD";
            return;
        }

        IsLoading = true;
        StatusMsg = "📤 Đang upload tài liệu...";
        CodePanel.SetRequest(new { id_number = IdNumber, file = SelectedFileName, sign_props = "[...]", security_level = "LEVEL_2" });
        CodePanel.SetLoading();

        try
        {
            _state.IdNumber = IdNumber;
            var data = await _api.SignGetChallengeAsync(_state.SelectedFilePath, IdNumber, DefaultSignProps);

            _state.TransactionCode = data.GetProperty("transaction_code").GetString() ?? "";
            _state.TokenSign       = data.GetProperty("token_sign").GetString() ?? "";
            _state.Docs            = ParseDocs(data);

            DocsInfo = string.Join("\n", _state.Docs.Select(d => $"• {d.DocName} ({d.DocId[..8]}...)"));

            CodePanel.SetResponse(data, PanelState.Success);
            StatusMsg = $"✅ Upload thành công. {_state.Docs.Count} tài liệu sẵn sàng ký.";
            IsDone    = true;
            OnDone?.Invoke();
        }
        catch (Exception ex)
        {
            CodePanel.SetError(ex.Message);
            StatusMsg = $"❌ Lỗi: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    private bool CanUpload() => !IsLoading;

    private static List<DocInfo> ParseDocs(System.Text.Json.JsonElement data)
    {
        var list = new List<DocInfo>();
        if (!data.TryGetProperty("docs", out var docs)) return list;
        foreach (var d in docs.EnumerateArray())
        {
            list.Add(new DocInfo(
                d.TryGetProperty("doc_id",        out var id)  ? id.GetString()  ?? "" : "",
                d.TryGetProperty("doc_name",      out var nm)  ? nm.GetString()  ?? "" : "",
                d.TryGetProperty("doc_challenge", out var ch)  ? ch.GetString()  ?? "" : ""
            ));
        }
        return list;
    }
}
