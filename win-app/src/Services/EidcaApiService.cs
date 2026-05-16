// Services/EidcaApiService.cs
using System.IO;
// HTTP client gọi eIDCA REST API — tương đương eidcaClient.js trong web-app.
// Hỗ trợ 4 flow: CTS Cá nhân (đăng ký + ký), CTS Tổ chức (đăng ký + ký).

using eIDCA.WinApp.Core;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace eIDCA.WinApp.Services;

// ── Request / Response Models ─────────────────────────────────────────────────

public record RawNfcData(
    [property: JsonPropertyName("sod")]  string Sod,
    [property: JsonPropertyName("dg1")]  string Dg1,
    [property: JsonPropertyName("dg2")]  string Dg2,
    [property: JsonPropertyName("dg13")] string Dg13,
    [property: JsonPropertyName("dg15")] string Dg15
);

public record DocInfo(
    [property: JsonPropertyName("doc_id")]        string DocId,
    [property: JsonPropertyName("doc_name")]      string DocName,
    [property: JsonPropertyName("doc_challenge")] string DocChallenge
);

public record DocSign(
    [property: JsonPropertyName("doc_id")]    string DocId,
    [property: JsonPropertyName("signature")] string Signature
);

public record SignedDoc(
    [property: JsonPropertyName("doc_id")]       string DocId,
    [property: JsonPropertyName("doc_name")]     string DocName,
    [property: JsonPropertyName("ca_signature")] string CaSignature,
    [property: JsonPropertyName("sign_at")]      string SignAt,
    [property: JsonPropertyName("doc_hash")]     string DocHash
);

// ── API Service ───────────────────────────────────────────────────────────────

public class EidcaApiService
{
    private readonly AppConfig _config;
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNamingPolicy        = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented               = false,
    };

    public EidcaApiService(AppConfig config)
    {
        _config = config;

        // Bỏ qua SSL lỗi cho môi trường dev / mock
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = (_, _, _, _) => true,
        };
        _http = new HttpClient(handler);
    }

    // ── FLOW 1 — CTS Cá nhân: Đăng ký ───────────────────────────────────────

    /// <summary>STEP 1: POST /ca/api/eid-personal/challenge</summary>
    public async Task<JsonElement> PersonalGetChallengeAsync(string idNumber)
    {
        var body = new { code = _config.PartnerCode, id_number = idNumber };
        return await PostJsonAsync("/ca/api/eid-personal/challenge", body);
    }

    /// <summary>STEP 2: POST /ca/api/eid-personal/signature</summary>
    public async Task<JsonElement> PersonalSendSignatureAsync(
        string transactionCode, string tokenChallenge,
        RawNfcData rawData, object info, string signature)
    {
        var body = new
        {
            code             = _config.PartnerCode,
            transaction_code = transactionCode,
            token_challenge  = tokenChallenge,
            raw_data         = rawData,
            info,
            signature,
        };
        return await PostJsonAsync("/ca/api/eid-personal/signature", body);
    }

    /// <summary>STEP 3: POST /ca/api/eid-personal/check</summary>
    public async Task<JsonElement> PersonalCheckStatusAsync(string transactionCode, string tokenSignature)
    {
        var body = new { code = _config.PartnerCode, transaction_code = transactionCode, token_signature = tokenSignature };
        return await PostJsonAsync("/ca/api/eid-personal/check", body);
    }

    // ── FLOW 2 — CTS Cá nhân: Ký văn bản ────────────────────────────────────

    /// <summary>STEP 1: POST /ca/api/sign/challenge  [multipart/form-data]</summary>
    public async Task<JsonElement> SignGetChallengeAsync(
        string filePath, string idNumber, string signPropsJson, string securityLevel = "LEVEL_2")
    {
        using var form = new MultipartFormDataContent();
        var fileBytes  = await File.ReadAllBytesAsync(filePath);
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(fileContent, "documents", Path.GetFileName(filePath));
        form.Add(new StringContent(idNumber),      "id_number");
        form.Add(new StringContent(signPropsJson), "sign_props");
        form.Add(new StringContent(securityLevel), "security_level");

        return await PostMultipartAsync("/ca/api/sign/challenge", form);
    }

    /// <summary>STEP 2: POST /ca/api/sign/signature</summary>
    public async Task<JsonElement> SignSendSignatureAsync(
        string transactionCode, string tokenSign, string selfieBase64, IEnumerable<DocSign> docSigns)
    {
        var body = new
        {
            code             = _config.PartnerCode,
            transaction_code = transactionCode,
            token_sign       = tokenSign,
            info             = new { image = selfieBase64 },
            doc_signs        = docSigns,
        };
        return await PostJsonAsync("/ca/api/sign/signature", body);
    }

    /// <summary>STEP 3: GET /ca/api/sign/download/{doc-id} → byte[]</summary>
    public async Task<byte[]> DownloadSignedDocAsync(string docId, string transactionCode, string tokenSign)
    {
        var url  = $"{_config.ApiBaseUrl}/ca/api/sign/download/{docId}";
        var req  = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("x-api-key",        _config.ApiKey);
        req.Headers.Add("code",             _config.PartnerCode);
        req.Headers.Add("transaction-code", transactionCode);
        req.Headers.Add("token-sign",       tokenSign);
        req.Headers.Add("os-type",          "Windows");

        var res = await _http.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadAsStringAsync();
            throw new Exception($"Download failed: HTTP {(int)res.StatusCode} - {err}");
        }
        return await res.Content.ReadAsByteArrayAsync();
    }

    // ── FLOW 3 — CTS Tổ chức: Đăng ký ───────────────────────────────────────

    /// <summary>STEP 1: POST /ca/api/eid-company/challenge</summary>
    public async Task<JsonElement> CompanyGetChallengeAsync(string idNumber, int companyId)
    {
        var body = new { code = _config.PartnerCode, id_number = idNumber, company_id = companyId };
        return await PostJsonAsync("/ca/api/eid-company/challenge", body);
    }

    /// <summary>STEP 2: POST /ca/api/eid-company/signature</summary>
    public async Task<JsonElement> CompanySendSignatureAsync(
        string transactionCode, string tokenChallenge,
        RawNfcData rawData, object info, string signature)
    {
        var body = new
        {
            code             = _config.PartnerCode,
            transaction_code = transactionCode,
            token_challenge  = tokenChallenge,
            raw_data         = rawData,
            info,
            signature,
        };
        return await PostJsonAsync("/ca/api/eid-company/signature", body);
    }

    /// <summary>STEP 3: POST /ca/api/eid-company/check</summary>
    public async Task<JsonElement> CompanyCheckStatusAsync(string transactionCode, string tokenSignature)
    {
        var body = new { code = _config.PartnerCode, transaction_code = transactionCode, token_signature = tokenSignature };
        return await PostJsonAsync("/ca/api/eid-company/check", body);
    }

    // ── FLOW 4 — CTS Tổ chức: Ký văn bản ────────────────────────────────────

    /// <summary>STEP 1: POST /ca/api/sign-company/challenge  [multipart]</summary>
    public async Task<JsonElement> SignCompanyGetChallengeAsync(
        string filePath, string idNumber, int companyId, string signPropsJson, string securityLevel = "LEVEL_2")
    {
        using var form = new MultipartFormDataContent();
        var fileBytes  = await File.ReadAllBytesAsync(filePath);
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(fileContent, "documents", Path.GetFileName(filePath));
        form.Add(new StringContent(idNumber),               "id_number");
        form.Add(new StringContent(companyId.ToString()),   "company_id");
        form.Add(new StringContent(signPropsJson),          "sign_props");
        form.Add(new StringContent(securityLevel),          "security_level");

        return await PostMultipartAsync("/ca/api/sign-company/challenge", form);
    }

    /// <summary>STEP 2: POST /ca/api/sign-company/signature</summary>
    public async Task<JsonElement> SignCompanySendSignatureAsync(
        string transactionCode, string tokenSign, string selfieBase64, IEnumerable<DocSign> docSigns)
    {
        var body = new
        {
            code             = _config.PartnerCode,
            transaction_code = transactionCode,
            token_sign       = tokenSign,
            info             = new { image = selfieBase64 },
            doc_signs        = docSigns,
        };
        return await PostJsonAsync("/ca/api/sign-company/signature", body);
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    private async Task<JsonElement> PostJsonAsync(string path, object body)
    {
        var url     = $"{_config.ApiBaseUrl}{path}";
        var json    = JsonSerializer.Serialize(body, _json);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        req.Headers.Add("x-api-key", _config.ApiKey);
        req.Headers.Add("Accept",    "*/*");

        var res     = await _http.SendAsync(req);
        var resBody = await res.Content.ReadAsStringAsync();
        var doc     = JsonDocument.Parse(resBody);
        var root    = doc.RootElement;

        if (!res.IsSuccessStatusCode)
        {
            var msg = root.TryGetProperty("error", out var err)
                    ? err.TryGetProperty("message", out var m) ? m.GetString() : null
                    : null;
            throw new Exception(msg ?? $"HTTP {(int)res.StatusCode}");
        }

        // Trả về data nếu có, nguyên root nếu không
        if (root.TryGetProperty("data", out var data)) return data;
        return root;
    }

    private async Task<JsonElement> PostMultipartAsync(string path, MultipartFormDataContent form)
    {
        var url = $"{_config.ApiBaseUrl}{path}";
        var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = form };
        req.Headers.Add("x-api-key", _config.ApiKey);
        req.Headers.Add("code",      _config.PartnerCode);
        // Không set Content-Type — HttpClient tự set multipart boundary

        var res     = await _http.SendAsync(req);
        var resBody = await res.Content.ReadAsStringAsync();
        var doc     = JsonDocument.Parse(resBody);
        var root    = doc.RootElement;

        if (!res.IsSuccessStatusCode || (root.TryGetProperty("success", out var ok) && !ok.GetBoolean()))
        {
            var msg = root.TryGetProperty("error", out var err)
                    ? err.TryGetProperty("message", out var m) ? m.GetString() : null
                    : null;
            throw new Exception(msg ?? $"HTTP {(int)res.StatusCode}");
        }

        if (root.TryGetProperty("data", out var data)) return data;
        return root;
    }

    public void Dispose() => _http.Dispose();
}
