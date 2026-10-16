// ViewModels/PersonalSign/Step3DownloadViewModel.cs
using System.IO;
// STEP 3: Download tài liệu đã ký — GET /ca/api/sign/download/{doc-id}
// Dùng chung cho cả Flow 2 (Cá nhân) và Flow 4 (Tổ chức).

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels.Common;
using Microsoft.Win32;

namespace eIDCA.WinApp.ViewModels.PersonalSign;

public partial class Step3DownloadViewModel : ObservableObject
{
    private readonly Func<string> _getTransactionCode;
    private readonly Func<string> _getTokenSigned;
    private readonly Func<List<SignedDoc>> _getSignedDocs;
    private readonly EidcaApiService _api;

    public CodePanelViewModel CodePanel { get; } = new() { RequestTitle = "GET /sign/download/{doc-id}" };

    [ObservableProperty]
    private bool _isActive = false;
    [ObservableProperty] private string _statusMsg  = "";
    [ObservableProperty] private bool   _isDownloading = false;

    public List<SignedDoc> SignedDocs => _getSignedDocs();

    public Step3DownloadViewModel(
        Func<string> getTransactionCode,
        Func<string> getTokenSigned,
        Func<List<SignedDoc>> getSignedDocs,
        EidcaApiService api)
    {
        _getTransactionCode = getTransactionCode;
        _getTokenSigned     = getTokenSigned;
        _getSignedDocs      = getSignedDocs;
        _api                = api;
    }

    public void Activate()
    {
        IsActive  = true;
        StatusMsg = $"✅ {SignedDocs.Count} tài liệu đã ký. Nhấn Download để lưu file.";
        OnPropertyChanged(nameof(SignedDocs));
    }

    [RelayCommand(CanExecute = nameof(CanDownload))]
    private async Task DownloadDocAsync(string docId)
    {
        var doc = SignedDocs.FirstOrDefault(d => d.DocId == docId);
        if (doc is null) return;

        var saveDlg = new SaveFileDialog
        {
            Title            = "Lưu tài liệu đã ký",
            FileName         = doc.DocName.Replace(".pdf", "") + "_signed.pdf",
            Filter           = "PDF files (*.pdf)|*.pdf",
            DefaultExt       = ".pdf",
        };

        if (saveDlg.ShowDialog() != true) return;

        IsDownloading = true;
        StatusMsg     = $"⬇️ Đang download {doc.DocName}...";
        CodePanel.SetRequest(new { doc_id = docId, transaction_code = _getTransactionCode(), token_sign = _getTokenSigned(), os_type = "Windows" });
        CodePanel.SetLoading();

        try
        {
            var bytes = await _api.DownloadSignedDocAsync(docId, _getTransactionCode(), _getTokenSigned());
            await File.WriteAllBytesAsync(saveDlg.FileName, bytes);

            CodePanel.SetResponse(new { saved = saveDlg.FileName, size_kb = bytes.Length / 1024 }, PanelState.Success);
            StatusMsg = $"✅ Đã lưu: {System.IO.Path.GetFileName(saveDlg.FileName)} ({bytes.Length / 1024} KB)";
        }
        catch (Exception ex)
        {
            CodePanel.SetError(ex.Message);
            StatusMsg = $"❌ Lỗi: {ex.Message}";
        }
        finally
        {
            IsDownloading = false;
        }
    }

    private bool CanDownload(string? docId) => !IsDownloading;
}
