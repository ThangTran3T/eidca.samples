using System.Security.Cryptography.X509Certificates;
using System.Text.Json;

namespace VNeCA.SigningPoC;

internal sealed class MainForm : Form
{
    private readonly ComboBox api = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 85 };
    private readonly ComboBox provider = new() { Width = 450, DropDownStyle = ComboBoxStyle.DropDown };
    private readonly TextBox reader = new() { Width = 250, PlaceholderText = "Để trống để middleware chọn token" };
    private readonly NumericUpDown providerType = new() { Minimum = 1, Maximum = uint.MaxValue, Value = 1, Width = 70 };
    private readonly NumericUpDown timeout = new() { Minimum = 1, Maximum = 600, Value = 60, Width = 65 };
    private readonly Button getCert = new() { Text = "1. Lấy chứng thư (GetCert)", AutoSize = true };
    private readonly Button validate = new() { Text = "2. Kiểm tra trust / revocation", AutoSize = true };
    private readonly Button sign = new() { Text = "3. Ký dữ liệu thử nghiệm…", AutoSize = true };
    private readonly Button cancel = new() { Text = "Hủy thao tác", AutoSize = true };
    private readonly Button export = new() { Text = "Xuất JSON…", AutoSize = true };
    private readonly ListView certificates = new()
    {
        View = View.Details, FullRowSelect = true, MultiSelect = false,
        HideSelection = false, Dock = DockStyle.Fill
    };
    private readonly TextBox details = ReadOnlyText();
    private readonly TextBox results = ReadOnlyText();
    private readonly TextBox activity = ReadOnlyText();
    private readonly Label status = new() { AutoSize = true, Padding = new Padding(0, 7, 0, 7) };
    private readonly ProgressBar progress = new() { Dock = DockStyle.Fill, Height = 5, Style = ProgressBarStyle.Continuous };
    private readonly FlowLayoutPanel settings = new() { AutoSize = true, Dock = DockStyle.Fill, WrapContents = true };
    private readonly FlowLayoutPanel buttons = new() { AutoSize = true, Dock = DockStyle.Fill };
    private Report report = new();
    private Candidate? selected;
    private CancellationTokenSource? operation;
    private bool closeAfterCancel;

    public MainForm()
    {
        Text = "VNeCA R0.2 — Bit4id CAPI/CNG Signing PoC";
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1200, 830);
        MinimumSize = new Size(1000, 720);
        Font = new Font("Segoe UI", 10);
        AutoScaleMode = AutoScaleMode.Dpi;
        api.Items.AddRange(new object[] { "CAPI", "CNG" });
        api.SelectedIndexChanged += (_, _) => ConfigureApi();
        api.SelectedIndex = 0;

        settings.Controls.AddRange(new Control[]
        {
            LabelFor("API"), api, LabelFor("Provider"), provider,
            LabelFor("CSP type"), providerType, LabelFor("Reader"), reader,
            LabelFor("Timeout (giây)"), timeout
        });
        buttons.Controls.AddRange(new Control[] { getCert, validate, sign, cancel, export });
        foreach (var column in new[] { ("Chủ thể", 240), ("Thumbprint", 345), ("Provider", 340), ("KeySpec", 90) })
            certificates.Columns.Add(column.Item1, column.Item2);

        var tabs = new TabControl { Dock = DockStyle.Fill };
        foreach (var tab in new[] { ("Chi tiết & dữ liệu thử", details), ("Kết quả JSON (đã ẩn danh tính)", results), ("Nhật ký thao tác", activity) })
        {
            var page = new TabPage(tab.Item1);
            page.Controls.Add(tab.Item2);
            tabs.TabPages.Add(page);
        }
        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill, Padding = new Padding(14), ColumnCount = 1, RowCount = 8
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 38));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 62));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 6));
        layout.Controls.Add(new Label
        {
            Text = "Lấy chứng thư → chọn một dòng → kiểm tra trust → xác nhận ký dữ liệu thử nghiệm",
            Dock = DockStyle.Fill, Font = new Font(Font, FontStyle.Bold), AutoEllipsis = true
        }, 0, 0);
        layout.Controls.Add(settings, 0, 1);
        layout.Controls.Add(buttons, 0, 2);
        layout.Controls.Add(certificates, 0, 3);
        layout.Controls.Add(new Label
        {
            Text = "PIN chỉ nhập trong hộp thoại middleware. Đọc được chứng thư công khai chưa chứng minh đã xác thực PIN.",
            AutoSize = true, Padding = new Padding(0, 8, 0, 8)
        }, 0, 4);
        layout.Controls.Add(tabs, 0, 5);
        layout.Controls.Add(status, 0, 6);
        layout.Controls.Add(progress, 0, 7);
        Controls.Add(layout);

        getCert.Click += async (_, _) => await RunOperation(GetCertificates);
        validate.Click += async (_, _) => await RunOperation(ValidateCertificate);
        sign.Click += async (_, _) => await ConfirmAndSign();
        cancel.Click += (_, _) => { operation?.Cancel(); Log("Đang hủy worker…"); };
        export.Click += (_, _) => ExportReport();
        certificates.SelectedIndexChanged += (_, _) => SelectCertificate();
        FormClosing += (_, e) =>
        {
            if (operation != null)
            {
                e.Cancel = true;
                closeAfterCancel = true;
                operation.Cancel();
            }
        };
        details.Text = "Bấm Lấy chứng thư để bắt đầu. Không cần biết trước thumbprint.\r\n\r\nDữ liệu cố định sẽ được ký:\r\n" + Policy.Data;
        RefreshState();
    }
    private static Label LabelFor(string text) => new() { Text = text, AutoSize = true, Margin = new Padding(7, 6, 3, 4) };
    private static TextBox ReadOnlyText() => new()
    {
        ReadOnly = true, Multiline = true, ScrollBars = ScrollBars.Both,
        WordWrap = false, Dock = DockStyle.Fill, Font = new Font("Consolas", 10)
    };
    private TimeSpan Deadline => TimeSpan.FromSeconds((double)timeout.Value);
    private void ConfigureApi()
    {
        bool capi = api.SelectedIndex == 0;
        provider.Items.Clear();
        provider.Items.AddRange(capi
            ? new object[] { "Microsoft Base Smart Card Crypto Provider", "Bit4id Universal Middleware Provider" }
            : new object[] { "Microsoft Smart Card Key Storage Provider" });
        provider.SelectedIndex = 0;
        reader.Enabled = providerType.Enabled = capi;
        if (!capi) reader.Text = "";
    }
    private void Log(string text) => activity.AppendText($"{DateTime.Now:HH:mm:ss} {text}\r\n");
    private void RefreshState()
    {
        bool busy = operation != null;
        settings.Enabled = !busy;
        certificates.Enabled = !busy;
        getCert.Enabled = export.Enabled = !busy;
        validate.Enabled = !busy && selected != null;
        sign.Enabled = !busy && selected != null && report.Validation.Status != "NOT_RUN";
        cancel.Enabled = busy;
        progress.Style = busy ? ProgressBarStyle.Marquee : ProgressBarStyle.Continuous;
        report.OverallStatus = Policy.Overall(report);
        status.Text = $"GetCert: {report.CertificateRetrieval.Status}    Chữ ký: {report.Crypto.Status}    Trust: {report.Validation.Status}    Tổng thể: {report.OverallStatus}";
        status.ForeColor = report.OverallStatus == "PASS" ? Color.DarkGreen : Color.DarkSlateGray;
        results.Text = JsonSerializer.Serialize(report, Policy.Json);
    }
    private async Task RunOperation(Func<CancellationToken, Task> action)
    {
        if (operation != null) return;
        using var cancellation = new CancellationTokenSource();
        operation = cancellation;
        RefreshState();
        try { await action(cancellation.Token); }
        catch (OperationCanceledException) { report.Errors.Add("CANCELLED"); Log("Đã hủy."); }
        catch (Exception e) { report.Errors.Add(Policy.Error(e)); Log("Lỗi: " + Policy.Error(e)); }
        finally
        {
            operation = null;
            RefreshState();
            if (closeAfterCancel) Close();
        }
    }
    private async Task GetCertificates(CancellationToken cancellation)
    {
        if (string.IsNullOrWhiteSpace(provider.Text)) throw new PocFailure("PROVIDER_REQUIRED");
        report = new Report();
        selected = null;
        certificates.Items.Clear();
        details.Text = "Đang gọi GetCert. Nhập PIN trong hộp thoại middleware nếu được yêu cầu.";
        Log("GetCert: chờ provider, timeout " + timeout.Value + " giây. Không ký ở bước này.");
        bool capi = api.SelectedIndex == 0;
        var response = await Supervisor.Run(new Request
        {
            Operation = capi ? "get-cert" : "get-cert-cng", Provider = provider.Text.Trim(),
            ProviderType = (uint)providerType.Value,
            Reader = capi && !string.IsNullOrWhiteSpace(reader.Text) ? reader.Text.Trim() : null,
            AllowProviderUi = true
        }, Deadline, cancellation);
        report.CertificateRetrieval = response.Retrieval ?? new RetrievalResult { Status = "FAIL", Error = response.Error ?? "MISSING_RESULT" };
        report.Errors.AddRange(response.Warnings);
        if (response.Error != null)
        {
            report.Errors.Add(response.Error);
            details.Text = "GetCert thất bại: " + response.Error;
            Log("GetCert: " + response.Error);
            return;
        }
        var candidates = Selection.DistinctBindings(response.Candidates);
        report.Inventory = candidates.Select(c => c.Describe()).ToList();
        certificates.BeginUpdate();
        try
        {
            foreach (var candidate in candidates)
            {
                using var cert = new X509Certificate2(Convert.FromBase64String(candidate.Der));
                var row = new ListViewItem(new[]
                {
                    cert.GetNameInfo(X509NameType.SimpleName, false), cert.Thumbprint,
                    candidate.Binding!.Provider, candidate.Binding.KeySpec.ToString()
                }) { Tag = candidate };
                certificates.Items.Add(row);
            }
        }
        finally { certificates.EndUpdate(); }
        details.Text = $"Đã lấy {candidates.Count} chứng thư/binding. Hãy bấm chọn một dòng; không có lựa chọn mặc định.\r\n\r\nDữ liệu thử nghiệm:\r\n{Policy.Data}";
        Log($"GetCert hoàn tất: {candidates.Count} lựa chọn. PIN authentication chưa được chứng minh bằng việc đọc cert.");
    }
    private void SelectCertificate()
    {
        if (operation != null) return;
        selected = certificates.SelectedItems.Count == 1 ? certificates.SelectedItems[0].Tag as Candidate : null;
        report.Selected = selected?.Describe();
        report.DiscoveryComplete = selected != null;
        report.Consent = false;
        report.Crypto = new CryptoResult();
        report.Validation = new ValidationResult();
        if (selected != null)
        {
            using var cert = new X509Certificate2(Convert.FromBase64String(selected.Der));
            var info = selected.Describe();
            details.Text = $"Subject: {cert.Subject}\r\nIssuer: {cert.Issuer}\r\nThumbprint: {cert.Thumbprint}\r\nSHA-256 certificate: {info.CertificateSha256}\r\n" +
                $"Hiệu lực: {cert.NotBefore:O} → {cert.NotAfter:O}\r\nProvider: {info.Provider}\r\nKeySpec: {info.KeySpec}\r\n" +
                $"Public-key OID: {info.PublicKeyOid}\r\nKey Usage: {info.KeyUsage}\r\nEKU: {string.Join(", ", info.EnhancedKeyUsageOids)}\r\n\r\n" +
                $"Dữ liệu UTF-8 cố định (không newline):\r\n{Policy.Data}\r\nSHA-256 dữ liệu: {report.TestDataSha256}";
            Log("Đã chọn chứng thư: " + info.Thumbprint + "; KeySpec=" + info.KeySpec);
        }
        RefreshState();
    }
    private async Task ValidateCertificate(CancellationToken cancellation)
    {
        if (selected == null) throw new PocFailure("SELECT_CERTIFICATE_FIRST");
        report.Validation = new ValidationResult();
        Log("Đang kiểm tra Windows trust và online revocation…");
        var response = await Supervisor.Run(new Request { Operation = "chain", Candidate = selected }, Deadline, cancellation);
        report.Validation = response.Validation ?? new ValidationResult
        {
            Status = "FAIL", Error = response.Error ?? "MISSING_RESULT", RevocationStatus = "UNKNOWN"
        };
        Log($"Trust: {report.Validation.Status}; revocation: {report.Validation.RevocationStatus}; " +
            string.Join(", ", report.Validation.ChainStatus));
        if (report.Validation.Error != null) Log(report.Validation.Error);
    }
    private async Task ConfirmAndSign()
    {
        if (operation != null || selected == null) return;
        using var cert = new X509Certificate2(Convert.FromBase64String(selected.Der));
        string algorithm;
        try
        {
            if (!Policy.SigningUsage(cert)) throw new PocFailure("KEY_USAGE_FORBIDS_SIGNING");
            algorithm = Policy.Algorithm(cert);
        }
        catch (Exception e) { MessageBox.Show(this, Policy.Error(e), "Không thể ký", MessageBoxButtons.OK, MessageBoxIcon.Error); return; }
        string prompt = $"Chứng thư: {cert.Subject}\nThumbprint: {cert.Thumbprint}\nProvider: {selected.Binding!.Provider}\nKeySpec: {selected.Binding.KeySpec}\n" +
            $"Thuật toán: {algorithm}\nTrust: {report.Validation.Status}; Revocation: {report.Validation.RevocationStatus}\n\n" +
            $"Chỉ ký chuỗi thử nghiệm cố định:\n{Policy.Data}\n\nSHA-256: {report.TestDataSha256}\n\n" +
            "Lỗi trust vẫn làm nghiệm thu tổng thể FAIL. Đồng ý ký thử nghiệm bằng chứng thư này?";
        if (MessageBox.Show(this, prompt, "Xác nhận ký dữ liệu thử nghiệm",
            MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
        var signingCandidate = selected;
        await RunOperation(async cancellation =>
        {
            report.Consent = true;
            report.Crypto = new CryptoResult();
            Log("Đã xác nhận ký. Đang mở khóa và ký dữ liệu cố định; middleware có thể hỏi PIN.");
            var response = await Supervisor.Run(new Request
            {
                Operation = "sign", Candidate = signingCandidate, Consent = true
            }, Deadline, cancellation);
            report.Crypto = response.Crypto ?? new CryptoResult { Status = "FAIL", Error = response.Error ?? "MISSING_RESULT" };
            Log($"Chữ ký: {report.Crypto.Status}; verify: {report.Crypto.Verified}; " +
                (report.Crypto.Error ?? "không có lỗi"));
        });
    }
    private void ExportReport()
    {
        report.OverallStatus = Policy.Overall(report);
        using var dialog = new SaveFileDialog
        {
            Title = "Xuất báo cáo JSON đã loại thông tin cá nhân đầy đủ",
            Filter = "JSON report (*.json)|*.json", DefaultExt = "json", AddExtension = true,
            FileName = $"vneca-r02-{DateTime.Now:yyyyMMdd-HHmmss}.json", OverwritePrompt = true
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        try
        {
            File.WriteAllText(dialog.FileName, JsonSerializer.Serialize(report, Policy.Json),
                new System.Text.UTF8Encoding(false));
            Log("Đã xuất báo cáo JSON.");
        }
        catch (Exception e) { MessageBox.Show(this, Policy.Error(e), "Không ghi được JSON", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }
    internal void AssertInitialState()
    {
        if (certificates.Items.Count != 0 || selected != null || validate.Enabled || sign.Enabled || cancel.Enabled ||
            !getCert.Enabled || !export.Enabled || report.Consent || report.Crypto.SignatureCreated ||
            !details.Text.Contains(Policy.Data) || ClientSize.Width < 1000 || api.SelectedIndex != 0)
            throw new InvalidOperationException("Invalid initial UI state.");
    }
}
