/**
 * win-app/src/api/MockData.cs
 * Dữ liệu mock tĩnh cho win-app (.NET/C#).
 * Dùng khi chạy offline hoặc integration test mà không cần mock server.
 *
 * Cách dùng:
 *   var response = MockData.PersonalChallengeResponse;
 *   var user     = MockData.Users[0];
 */

using System.Collections.Generic;

namespace EidcaWinApp.Api
{
    // ─── Models ──────────────────────────────────────────────────────────────

    public record MockUser(
        string IdNumber,
        string FullName,
        string DateOfBirth,
        string DateOfIssue,
        string Phone,
        string Email,
        string PermanentCity,
        string PermanentDistrict
    );

    public record MockCompany(int CompanyId, string Name, string TaxCode);

    public record NfcRawData(string Sod, string Dg1, string Dg2, string Dg13, string Dg15);

    public record DeviceInfo(
        string IpAddress,
        string MachineName,
        string MachineType,
        string OperatingSystem,
        string Version,
        string SerialDevice,
        string PermanentCity,
        string PermanentDistrict
    );

    public record ApiError(string Code, string Message);

    public record ApiResponse<T>(bool Success, ApiError? Error, T? Data);

    // ─── Challenge / Signature response models ────────────────────────────────

    public record ChallengeData(string TransactionCode, string? Challenge, string TokenChallenge);

    public record SignatureStatusData(
        string TransactionCode,
        string Status,          // processing | completed | failed
        string Interval,
        string ExpiredAt,
        string TokenSignature
    );

    public record CertInfo(
        string SerialNumber,
        string IdNumber,
        string FullName,
        string Phone,
        string Email,
        string Cert,
        string DateIssue,
        string DateExpire
    );

    public record CheckData(string TransactionCode, string Status, CertInfo? CertInfo);

    // Sign flow models
    public record DocItem(string DocId, string DocName, string DocType, string DocChallenge);
    public record SignChallengeData(string TransactionCode, string TokenSign, List<DocItem> Docs);

    public record SignedDoc(
        string DocId, string DocName, string CaSignature,
        string SignAt, string ExpireAt, string DocHash
    );
    public record SignSignatureData(
        string TransactionCode, string Status, string Token,
        string Interval, string ExpiredAt, List<SignedDoc> SignedDocs
    );

    public record CheckSessionData(string RemainingTime);

    // QR models
    public record QrData(string EncryptedData, string ExpiredAt, string Type, string Url, string SessionId);

    public record QrSseData(
        string CaStatus, string Result, string TransactionCode,
        string? TokenSign, string? Cert, string? DocIds
    );

    // ─── MockData static class ────────────────────────────────────────────────

    public static class MockData
    {
        public const string PartnerCode  = "PARTNER_DEMO_001";
        public const string MockApiKey   = "MOCK_API_KEY_DEMO";
        public const string MockServerUrl = "http://localhost:3001";

        // ── Users & Companies ─────────────────────────────────────────────────

        public static readonly List<MockUser> Users = new()
        {
            new MockUser(
                IdNumber:           "001087012345",
                FullName:           "NGUYỄN VĂN AN",
                DateOfBirth:        "1990-05-15",
                DateOfIssue:        "2021-03-20",
                Phone:              "0912345678",
                Email:              "nguyenvanan@gmail.com",
                PermanentCity:      "HN",
                PermanentDistrict:  "Hà Nội"
            ),
            new MockUser(
                IdNumber:           "079091067890",
                FullName:           "TRẦN THỊ BÍCH",
                DateOfBirth:        "1995-08-22",
                DateOfIssue:        "2022-07-10",
                Phone:              "0987654321",
                Email:              "tranthibich@company.vn",
                PermanentCity:      "HCM",
                PermanentDistrict:  "Hồ Chí Minh"
            ),
        };

        public static readonly List<MockCompany> Companies = new()
        {
            new MockCompany(1001, "CÔNG TY TNHH CÔNG NGHỆ ABC", "0123456789"),
            new MockCompany(1002, "CÔNG TY CỔ PHẦN XYZ VIỆT NAM", "0987654321"),
        };

        // ── NFC & Device ──────────────────────────────────────────────────────

        public static readonly NfcRawData NfcData = new(
            Sod:   "TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2JNd0...",
            Dg1:   "YTExMTExMTExMTExMTExMTExMTExMTE...",
            Dg2:   "aW1hZ2VCYXNlNjRvZlBob3RvSW1hZ2U...",
            Dg13:  "ZGcxM0RhdGFFeHRlbmRlZEluZm9ybWF...",
            Dg15:  "ZGcxNVJTQVB1YmxpY0tleURhdGFCYXN..."
        );

        public static readonly DeviceInfo Device = new(
            IpAddress:          "192.168.1.105",
            MachineName:        "DESKTOP-DEMO01",
            MachineType:        "Desktop",
            OperatingSystem:    "Windows 11",
            Version:            "23H2",
            SerialDevice:       "SN-3TE4-00123456",
            PermanentCity:      "HN",
            PermanentDistrict:  "Hà Nội"
        );

        public const string SelfieBase64      = "/9j/4AAQSkZJRgABAQAAAQABAAD...MOCK_SELFIE";
        public const string HandSigBase64     = "iVBORw0KGgoAAAANSUhEUgAA...MOCK_HAND_SIG";

        // ─── FLOW 1: CTS Cá nhân — Đăng ký ──────────────────────────────────

        public static readonly ApiResponse<ChallengeData> PersonalChallengeResponse = new(
            Success: true,
            Error:   null,
            Data: new ChallengeData(
                TransactionCode: "TXN-EID-20260511-001",
                Challenge:       "ch_a3f9b2d1e4c7f8a0b5d2e6f1c3a9b7d4",
                TokenChallenge:  "eyJhbGciOiJIUzI1NiJ9.eyJjaGFsbGVuZ2UiOiJjaF9hM2Y5In0.MOCK_SIG_1"
            )
        );

        public static readonly ApiResponse<SignatureStatusData> PersonalSignatureResponse = new(
            Success: true,
            Error:   null,
            Data: new SignatureStatusData(
                TransactionCode: "TXN-EID-20260511-001",
                Status:          "processing",
                Interval:        "3000",
                ExpiredAt:       "2026-05-11T23:30:00+07:00",
                TokenSignature:  "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbmF0dXJlIn0.MOCK_SIG_2"
            )
        );

        public static readonly ApiResponse<CheckData> PersonalCheckProcessing = new(
            Success: true, Error: null,
            Data: new CheckData("TXN-EID-20260511-001", "processing", null)
        );

        public static readonly ApiResponse<CheckData> PersonalCheckCompleted = new(
            Success: true, Error: null,
            Data: new CheckData(
                TransactionCode: "TXN-EID-20260511-001",
                Status:          "completed",
                CertInfo: new CertInfo(
                    SerialNumber: "CTS-2026-001-0000123",
                    IdNumber:     "001087012345",
                    FullName:     "NGUYỄN VĂN AN",
                    Phone:        "0912345678",
                    Email:        "nguyenvanan@gmail.com",
                    Cert:         "MIIFaDCCBBCgAwIBAgIQCTS2026001MOCK...BASE64",
                    DateIssue:    "2026-05-11",
                    DateExpire:   "2029-05-11"
                )
            )
        );

        // ─── FLOW 2: CTS Cá nhân — Ký văn bản ────────────────────────────────

        public static readonly ApiResponse<SignChallengeData> SignChallengeResponse = new(
            Success: true, Error: null,
            Data: new SignChallengeData(
                TransactionCode: "TXN-SIGN-20260511-001",
                TokenSign:       "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbiJ9.MOCK_SIGN_TOKEN",
                Docs: new()
                {
                    new DocItem(
                        DocId:        "doc-uuid-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                        DocName:      "hop-dong-mau-001.pdf",
                        DocType:      "file",
                        DocChallenge: "eyJhbGciOiJIUzI1NiJ9.eyJkb2NJZCI6ImRvYy11dWlkIn0.MOCK_DOC_CHALLENGE"
                    ),
                }
            )
        );

        public static readonly ApiResponse<SignSignatureData> SignSignatureResponse = new(
            Success: true, Error: null,
            Data: new SignSignatureData(
                TransactionCode: "TXN-SIGN-20260511-001",
                Status:          "completed",
                Token:           "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbmVkIn0.MOCK_SIGNED",
                Interval:        "2000",
                ExpiredAt:       "2027-05-11T00:00:00+07:00",
                SignedDocs: new()
                {
                    new SignedDoc(
                        DocId:        "doc-uuid-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                        DocName:      "hop-dong-mau-001.pdf",
                        CaSignature:  "MIIG...BASE64_CA_SIGNATURE",
                        SignAt:       "2026-05-11T23:15:30+07:00",
                        ExpireAt:     "2027-05-11T23:15:30+07:00",
                        DocHash:      "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
                    ),
                }
            )
        );

        public static readonly ApiResponse<CheckSessionData> CheckSessionResponse = new(
            Success: true, Error: null,
            Data: new CheckSessionData("2026-05-11T23:28:06+07:00")
        );

        // ─── FLOW 3: CTS Cá nhân TT — Đăng ký ────────────────────────────────

        public static readonly ApiResponse<ChallengeData> CompanyChallengeResponse = new(
            Success: true, Error: null,
            Data: new ChallengeData(
                TransactionCode: "TXN-COM-20260511-001",
                Challenge:       null,
                TokenChallenge:  "eyJhbGciOiJIUzI1NiJ9.eyJjb21wYW55X2lkIjoxMDAxfQ.MOCK_COM_SIG"
            )
        );

        public static readonly ApiResponse<CheckData> CompanyCheckCompleted = new(
            Success: true, Error: null,
            Data: new CheckData(
                TransactionCode: "TXN-COM-20260511-001",
                Status:          "completed",
                CertInfo: new CertInfo(
                    SerialNumber: "CTS-COM-2026-001-0000456",
                    IdNumber:     "079091067890",
                    FullName:     "TRẦN THỊ BÍCH",
                    Phone:        "0987654321",
                    Email:        "tranthibich@company.vn",
                    Cert:         "MIIFaDCCBBCgAwIBAgIQCOM2026001MOCK...BASE64",
                    DateIssue:    "2026-05-11",
                    DateExpire:   "2029-05-11"
                )
            )
        );

        // ─── FLOW 5/6: QR Code ────────────────────────────────────────────────

        public static readonly ApiResponse<QrData> QrOnboardResponse = new(
            Success: true, Error: null,
            Data: new QrData(
                EncryptedData: "eyJhbGciOiJSU0EtT0FFUCJ9.MOCK_ENCRYPTED_QR",
                ExpiredAt:     "2026-05-11T23:45:00+07:00",
                Type:          "Personal",
                Url:           "https://api.eidca.vn/ca/qr/onboard/QR-SESSION-20260511-001",
                SessionId:     "QR-SESSION-20260511-001"
            )
        );

        public static readonly QrSseData QrOnboardSseCompleted = new(
            CaStatus:        "completed",
            Result:          "SUCCESS",
            TransactionCode: "TXN-EID-20260511-001",
            TokenSign:       null,
            Cert:            "MIIFaDCCBBCgAwIBAgIQCTS2026001MOCK...BASE64",
            DocIds:          null
        );

        public static readonly QrSseData QrSignSseCompleted = new(
            CaStatus:        "completed",
            Result:          "SUCCESS",
            TransactionCode: "TXN-SIGN-20260511-001",
            TokenSign:       "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbmVkIn0.MOCK_SIGNED",
            Cert:            "MIIFaDCCBBCgAwIBAgIQCTS2026001MOCK...BASE64",
            DocIds:          "doc-uuid-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        );

        // ─── Error Responses ──────────────────────────────────────────────────

        public static ApiResponse<object> ErrorUnauthorized => new(
            false, new ApiError("401", "APIKey không đúng hoặc không hợp lệ"), null
        );

        public static ApiResponse<object> ErrorUnknown => new(
            false, new ApiError("ERROR_99", "Lỗi hệ thống không xác định. Vui lòng thử lại."), null
        );
    }
}
