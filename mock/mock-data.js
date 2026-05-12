/**
 * mock-data.js
 * Dữ liệu mock dùng chung cho tất cả các luồng API eIDCA.
 * Sử dụng trong: web-app (JS) và win-app (import qua mock server Node.js).
 *
 * Base URL mock server: http://localhost:3001
 */

// ─────────────────────────────────────────────
// SHARED — Dữ liệu người dùng mẫu
// ─────────────────────────────────────────────

export const MOCK_USERS = [
  {
    id_number: "001087012345",
    full_name: "NGUYỄN VĂN AN",
    date_of_birth: "1990-05-15",
    date_of_issue: "2021-03-20",
    phone: "0912345678",
    email: "nguyenvanan@gmail.com",
    permanent_city: "HN",
    permanent_district: "Hà Nội",
  },
  {
    id_number: "079091067890",
    full_name: "TRẦN THỊ BÍCH",
    date_of_birth: "1995-08-22",
    date_of_issue: "2022-07-10",
    phone: "0987654321",
    email: "tranthibich@company.vn",
    permanent_city: "HCM",
    permanent_district: "Hồ Chí Minh",
  },
];

export const MOCK_COMPANIES = [
  { company_id: 1001, name: "CÔNG TY TNHH CÔNG NGHỆ ABC", tax_code: "0123456789" },
  { company_id: 1002, name: "CÔNG TY CỔ PHẦN XYZ VIỆT NAM", tax_code: "0987654321" },
];

export const MOCK_PARTNER_CODE = "PARTNER_DEMO_001";

// ─────────────────────────────────────────────
// SHARED — NFC Raw Data mẫu (Base64 giả lập)
// ─────────────────────────────────────────────

export const MOCK_NFC_RAW_DATA = {
  sod: "TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2JNd0..."  ,  // Base64 SOD ICAO container (giả lập)
  dg1: "YTExMTExMTExMTExMTExMTExMTExMTE...",        // Base64 DG1 (thông tin cơ bản)
  dg2: "aW1hZ2VCYXNlNjRvZlBob3RvSW1hZ2U...",        // Base64 DG2 (ảnh khuôn mặt)
  dg13: "ZGcxM0RhdGFFeHRlbmRlZEluZm9ybWF...",       // Base64 DG13 (thông tin mở rộng)
  dg15: "ZGcxNVJTQVB1YmxpY0tleURhdGFCYXN...",       // Base64 DG15 (Public Key)
};

export const MOCK_SELFIE_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS" +
  "Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/..."; // Ảnh selfie giả lập

export const MOCK_HAND_SIG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAASwAAADICAYAAABS39xVAAAACXBIWXMAAAsTAAAL..."; // Chữ ký tay giả lập

// ─────────────────────────────────────────────
// SHARED — Device Info mẫu
// ─────────────────────────────────────────────

export const MOCK_DEVICE_INFO = {
  ip_address: "192.168.1.105",
  machine_name: "DESKTOP-DEMO01",
  machine_type: "Desktop",
  operating_system: "Windows 11",
  version: "23H2",
  serial_device: "SN-3TE4-00123456",
  permanent_city: "HN",
  permanent_district: "Hà Nội",
};

// ─────────────────────────────────────────────
// FLOW 1 — CTS Cá nhân: Đăng ký
// ─────────────────────────────────────────────

/** STEP 1: POST /ca/api/eid-personal/challenge */
export const MOCK_PERSONAL_CHALLENGE_REQUEST = {
  code: MOCK_PARTNER_CODE,
  id_number: MOCK_USERS[0].id_number,
};

export const MOCK_PERSONAL_CHALLENGE_RESPONSE = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-EID-20260511-001",
    challenge: "ch_a3f9b2d1e4c7f8a0b5d2e6f1c3a9b7d4",
    token_challenge: "eyJhbGciOiJIUzI1NiJ9.eyJjaGFsbGVuZ2UiOiJjaF9hM2Y5YjJkMWU0YzdmOGEwYjVkMmU2ZjFjM2E5YjdkNCIsImV4cCI6MTc0NzA2MDAwMH0.MOCK_SIG_1",
  },
};

/** STEP 2: POST /ca/api/eid-personal/signature */
export const MOCK_PERSONAL_SIGNATURE_REQUEST = {
  code: MOCK_PARTNER_CODE,
  transaction_code: "TXN-EID-20260511-001",
  token_challenge: MOCK_PERSONAL_CHALLENGE_RESPONSE.data.token_challenge,
  raw_data: MOCK_NFC_RAW_DATA,
  info: {
    ...MOCK_DEVICE_INFO,
    phone: MOCK_USERS[0].phone,
    email: MOCK_USERS[0].email,
    image: MOCK_SELFIE_BASE64,
    hand_sig_image_base64: MOCK_HAND_SIG_BASE64,
  },
  signature: "MOCK_SIG_BASE64_FROM_TOKEN_CHALLENGE_001",
};

export const MOCK_PERSONAL_SIGNATURE_RESPONSE = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-EID-20260511-001",
    status: "processing",
    interval: "3000",
    expired_at: "2026-05-11T23:30:00+07:00",
    token_signature: "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbmF0dXJlIiwidHhuIjoiVFhOLUVJRC0yMDI2MDUxMS0wMDEifQ.MOCK_SIG_2",
  },
};

/** STEP 3: POST /ca/api/eid-personal/check */
export const MOCK_PERSONAL_CHECK_REQUEST = {
  code: MOCK_PARTNER_CODE,
  transaction_code: "TXN-EID-20260511-001",
  token_signature: MOCK_PERSONAL_SIGNATURE_RESPONSE.data.token_signature,
};

export const MOCK_PERSONAL_CHECK_RESPONSE_PROCESSING = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-EID-20260511-001",
    status: "processing",
    cert_info: null,
  },
};

export const MOCK_PERSONAL_CHECK_RESPONSE_COMPLETED = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-EID-20260511-001",
    status: "completed",
    cert_info: {
      serial_number: "CTS-2026-001-0000123",
      id_number: "001087012345",
      full_name: "NGUYỄN VĂN AN",
      phone: "0912345678",
      email: "nguyenvanan@gmail.com",
      cert: "MIIFaDCCBBCgAwIBAgIQCTS2026001MOCK...BASE64_CERT_DATA",
      date_issue: "2026-05-11",
      date_expire: "2029-05-11",
    },
  },
};

// ─────────────────────────────────────────────
// FLOW 2 — CTS Cá nhân: Ký văn bản
// ─────────────────────────────────────────────

/** STEP 1: POST /ca/api/sign/challenge */
export const MOCK_SIGN_CHALLENGE_REQUEST = {
  code: MOCK_PARTNER_CODE,
  id_number: MOCK_USERS[0].id_number,
  sign_props: JSON.stringify({
    page: 1,
    x: 100,
    y: 700,
    width: 200,
    height: 80,
    reason: "Ký hợp đồng điện tử",
    location: "Hà Nội, Việt Nam",
  }),
  expire_at: "2026-06-11T00:00:00+07:00",
  doc_name: "hop-dong-mau-001.pdf",
  session_timeout: "ONE_HOUR",
  security_level: "LEVEL_2",
  // documents: <File> — không mock được binary, xem ghi chú bên dưới
};

export const MOCK_SIGN_CHALLENGE_RESPONSE = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-SIGN-20260511-001",
    token_sign: "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbiIsInR4biI6IlRYTi1TSUdOLTIwMjYwNTExLTAwMSJ9.MOCK_SIGN_TOKEN",
    docs: [
      {
        doc_id: "doc-uuid-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        doc_name: "hop-dong-mau-001.pdf",
        doc_type: "file",
        doc_challenge: "eyJhbGciOiJIUzI1NiJ9.eyJkb2NJZCI6ImRvYy11dWlkLWExYjJjM2Q0In0.MOCK_DOC_CHALLENGE",
      },
    ],
  },
};

/** STEP 2: POST /ca/api/sign/signature */
export const MOCK_SIGN_SIGNATURE_REQUEST = {
  code: MOCK_PARTNER_CODE,
  transaction_code: "TXN-SIGN-20260511-001",
  token_sign: MOCK_SIGN_CHALLENGE_RESPONSE.data.token_sign,
  info: {
    image: MOCK_SELFIE_BASE64,
  },
  doc_signs: [
    {
      doc_id: "doc-uuid-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      signature: "MOCK_DOC_SIG_BASE64_FROM_DOC_CHALLENGE_001",
    },
  ],
};

export const MOCK_SIGN_SIGNATURE_RESPONSE = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-SIGN-20260511-001",
    status: "completed",
    token: "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbmVkIn0.MOCK_SIGNED_TOKEN",
    interval: "2000",
    expired_at: "2027-05-11T00:00:00+07:00",
    signed_docs: [
      {
        doc_id: "doc-uuid-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        doc_name: "hop-dong-mau-001.pdf",
        ca_signature: "MIIG...BASE64_CA_SIGNATURE_DATA_FOR_PDF",
        sign_at: "2026-05-11T23:15:30+07:00",
        expire_at: "2027-05-11T23:15:30+07:00",
        doc_hash: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      },
    ],
  },
};

/** STEP 4: GET /ca/api/event/check-session */
export const MOCK_CHECK_SESSION_RESPONSE = {
  success: true,
  error: null,
  data: {
    remaining_time: "2026-05-11T23:28:06+07:00",
  },
};

// ─────────────────────────────────────────────
// FLOW 3 — CTS Cá nhân thuộc Tổ chức: Đăng ký
// ─────────────────────────────────────────────

/** STEP 1: POST /ca/api/eid-company/challenge */
export const MOCK_COMPANY_CHALLENGE_REQUEST = {
  code: MOCK_PARTNER_CODE,
  id_number: MOCK_USERS[1].id_number,
  company_id: MOCK_COMPANIES[0].company_id,
};

export const MOCK_COMPANY_CHALLENGE_RESPONSE = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-COM-20260511-001",
    token_challenge: "eyJhbGciOiJIUzI1NiJ9.eyJjaGFsbGVuZ2UiOiJjaF9jb21wYW55XzAwMSIsImNvbXBhbnlfaWQiOjEwMDF9.MOCK_COM_SIG",
  },
};

/** STEP 2: POST /ca/api/eid-company/signature */
export const MOCK_COMPANY_SIGNATURE_REQUEST = {
  code: MOCK_PARTNER_CODE,
  transaction_code: "TXN-COM-20260511-001",
  token_challenge: MOCK_COMPANY_CHALLENGE_RESPONSE.data.token_challenge,
  raw_data: MOCK_NFC_RAW_DATA,
  info: {
    phone: MOCK_USERS[1].phone,
    email: MOCK_USERS[1].email,
    image: MOCK_SELFIE_BASE64,
  },
  signature: "MOCK_SIG_BASE64_FROM_COMPANY_TOKEN_001",
};

export const MOCK_COMPANY_SIGNATURE_RESPONSE = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-COM-20260511-001",
    status: "processing",
    interval: "3000",
    expired_at: "2026-05-11T23:30:00+07:00",
    token_signature: "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoiY29tcGFueV9zaWduYXR1cmUifQ.MOCK_COM_SIG_2",
  },
};

/** STEP 3: POST /ca/api/eid-company/check */
export const MOCK_COMPANY_CHECK_RESPONSE_COMPLETED = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-COM-20260511-001",
    status: "completed",
    cert_info: {
      serial_number: "CTS-COM-2026-001-0000456",
      id_number: "079091067890",
      full_name: "TRẦN THỊ BÍCH",
      phone: "0987654321",
      email: "tranthibich@company.vn",
      cert: "MIIFaDCCBBCgAwIBAgIQCOM2026001MOCK...BASE64_CERT_DATA",
      date_issue: "2026-05-11",
      date_expire: "2029-05-11",
    },
  },
};

// ─────────────────────────────────────────────
// FLOW 4 — CTS Cá nhân TT: Ký văn bản
// ─────────────────────────────────────────────

/** STEP 1: POST /ca/api/sign-company/challenge */
export const MOCK_SIGN_COMPANY_CHALLENGE_REQUEST = {
  code: MOCK_PARTNER_CODE,
  id_number: MOCK_USERS[1].id_number,
  company_id: String(MOCK_COMPANIES[0].company_id),
  sign_props: JSON.stringify({ page: 1, x: 50, y: 650, width: 200, height: 80 }),
  security_level: "LEVEL_2",
  doc_name: "bien-ban-hop-dong-abc.pdf",
  session_timeout: "TWO_HOURS",
};

export const MOCK_SIGN_COMPANY_CHALLENGE_RESPONSE = {
  success: true,
  error: null,
  data: {
    transaction_code: "TXN-SIGN-COM-20260511-001",
    token_sign: "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbl9jb21wYW55In0.MOCK_SIGN_COM_TOKEN",
    docs: [
      {
        doc_id: "doc-uuid-b9c8d7e6-f5a4-3210-fedc-ba9876543210",
        doc_name: "bien-ban-hop-dong-abc.pdf",
        doc_type: "file",
        challenge: "eyJhbGciOiJIUzI1NiJ9.eyJkb2NJZCI6ImRvYy11dWlkLWI5YzhkN2U2In0.MOCK_COM_DOC_CHALLENGE",
      },
    ],
  },
};

// ─────────────────────────────────────────────
// FLOW 5 — QR Code: Đăng ký CTS
// ─────────────────────────────────────────────

/** STEP 1: POST /ca/api/qr/onboard */
export const MOCK_QR_ONBOARD_REQUEST = {
  id_number: MOCK_USERS[0].id_number,
  full_name: MOCK_USERS[0].full_name,
  date_of_birth: MOCK_USERS[0].date_of_birth,
  date_of_issue: MOCK_USERS[0].date_of_issue,
  code: MOCK_PARTNER_CODE,
  type: "Personal",
};

export const MOCK_QR_ONBOARD_RESPONSE = {
  success: true,
  error: null,
  data: {
    encrypted_data: "eyJhbGciOiJSU0EtT0FFUCIsImVuYyI6IkEyNTZHQ00ifQ.MOCK_ENCRYPTED_QR_DATA",
    expired_at: "2026-05-11T23:45:00+07:00",
    type: "Personal",
    url: "https://api.eidca.vn/ca/qr/onboard/QR-SESSION-20260511-001",
    session_id: "QR-SESSION-20260511-001",
  },
};

/** STEP 5: GET /ca/apievent?session_id= (SSE Event) */
export const MOCK_QR_ONBOARD_SSE_EVENT = {
  success: true,
  error: null,
  data: {
    ca_status: "completed",
    result: "SUCCESS",
    transaction_code: "TXN-EID-20260511-001",
    token_sign: null,   // null với luồng đăng ký, có giá trị với luồng ký
    cert: "MIIFaDCCBBCgAwIBAgIQCTS2026001MOCK...BASE64_CERT_DATA",
    doc_ids: null,
  },
};

// ─────────────────────────────────────────────
// FLOW 6 — QR Code: Ký văn bản
// ─────────────────────────────────────────────

/** STEP 1: POST /ca/api/qr/sign */
export const MOCK_QR_SIGN_REQUEST = {
  code: MOCK_PARTNER_CODE,
  sign_props: JSON.stringify({ page: 1, x: 100, y: 700, width: 200, height: 80 }),
  security_level: "LEVEL_2",
  info: JSON.stringify({
    id_number: MOCK_USERS[0].id_number,
    full_name: MOCK_USERS[0].full_name,
    date_of_birth: MOCK_USERS[0].date_of_birth,
  }),
  type: "Personal",
  // documents: <File binary>
};

export const MOCK_QR_SIGN_RESPONSE = {
  success: true,
  error: null,
  data: {
    encrypted_data: "eyJhbGciOiJSU0EtT0FFUCIsImVuYyI6IkEyNTZHQ00ifQ.MOCK_ENCRYPTED_QR_SIGN_DATA",
    expired_at: "2026-05-11T23:45:00+07:00",
    type: "Personal",
    url: "https://api.eidca.vn/ca/qr/sign/QR-SIGN-SESSION-20260511-001",
    session_id: "QR-SIGN-SESSION-20260511-001",
  },
};

/** STEP 5: GET /ca/apievent?session_id= (SSE Event — luồng ký) */
export const MOCK_QR_SIGN_SSE_EVENT = {
  success: true,
  error: null,
  data: {
    ca_status: "completed",
    result: "SUCCESS",
    transaction_code: "TXN-SIGN-20260511-001",
    token_sign: "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoic2lnbmVkIn0.MOCK_SIGNED_TOKEN",
    cert: "MIIFaDCCBBCgAwIBAgIQCTS2026001MOCK...BASE64_CERT_DATA",
    doc_ids: "doc-uuid-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  },
};

// ─────────────────────────────────────────────
// ERROR RESPONSES — Mẫu lỗi
// ─────────────────────────────────────────────

export const MOCK_ERROR_UNAUTHORIZED = {
  success: false,
  error: { code: "401", message: "APIKey không đúng hoặc không hợp lệ" },
  data: null,
};

export const MOCK_ERROR_UNKNOWN = {
  success: false,
  error: { code: "ERROR_99", message: "Lỗi hệ thống không xác định. Vui lòng thử lại." },
  data: null,
};

export const MOCK_ERROR_PROCESSING_FAILED = {
  success: false,
  error: { code: "ERROR_CA_001", message: "Cấp CTS thất bại. Thông tin NFC không hợp lệ." },
  data: null,
};

// ─────────────────────────────────────────────
// DEVICE MOCKS — Thông qua Socket.IO (NFC Reader & Webcam)
// ─────────────────────────────────────────────

/** 1.1 Lấy thông tin thiết bị (getInfoDevice) */
export const MOCK_DEVICE_INFO_RESPONSE = {
  version: "1.1",
  serial_nfc: "00123000012",
  serial_device: "0022300111",
  date: "2026-05-12T02:39:59.852Z",
};

/** 1.2 Sự kiện đọc thẻ (Card Insert) */

// A. Đọc thẻ thành công - Lấy dữ liệu Text (id: 2)
export const MOCK_DEVICE_EVENT_PERSONAL_INFO = {
  id: 2,
  message: "read card successfully!",
  data: {
    idCode: MOCK_USERS[0].id_number,
    oldIdCode: "123456789",
    personName: MOCK_USERS[0].full_name,
    dateOfBirth: "15051990",
    gender: "Nam",
    nationality: "Việt Nam",
    race: "Kinh",
    religion: "Không",
    originPlace: MOCK_USERS[0].permanent_district,
    residencePlace: MOCK_USERS[0].permanent_city,
    personalIdentification: "Sẹo nhỏ dưới mắt trái",
    issueDate: "20032021",
    expiryDate: "15052030",
    fatherName: "Nguyễn Văn B",
    motherName: "Trần Thị C",
    wifeName: "",
    qr: "001087012345|123456789|Nguyễn Văn An|15051990|Nam|Hà Nội|20032021",
  },
};

// B. Đọc thẻ thành công - Lấy dữ liệu Ảnh & Raw Phân vùng (id: 4)
export const MOCK_DEVICE_EVENT_AVATAR_IMAGE = {
  id: 4,
  data: {
    img_data: MOCK_SELFIE_BASE64,
    dg1: MOCK_NFC_RAW_DATA.dg1,
    dg2: MOCK_NFC_RAW_DATA.dg2,
    dg13: MOCK_NFC_RAW_DATA.dg13,
    dg14: "ZGcxNERhdGFCYXNlNjQ...",
    dg15: MOCK_NFC_RAW_DATA.dg15,
    sod: MOCK_NFC_RAW_DATA.sod,
  },
};

// C. Đọc thẻ thành công - Tách chuỗi DS_CERT (id: 5)
export const MOCK_DEVICE_EVENT_DS_CERT = {
  id: 5,
  data: {
    CA: "1",
    AA: {
      aa_signature: "",
    },
    PA: {
      hash_dg1: "aGFzaF9kZzE=",
      hash_dg2: "aGFzaF9kZzI=",
      hash_dg13: "aGFzaF9kZzEz",
      hash_dg14: "aGFzaF9kZzE0",
      hash_dg15: "aGFzaF9kZzE1",
      cert: "MIIFaDCCBBCgAwIBAgIQ...",
      sod: MOCK_NFC_RAW_DATA.sod,
    },
  },
};

// D. Quét thẻ thất bại (id: 3)
export const MOCK_DEVICE_EVENT_ERROR = {
  id: 3,
  message: "Thẻ không hợp lệ hoặc đọc lỗi.",
};

/** 1.3 Ký số trên thẻ Căn cước (Active Authentication) */

// Lệnh gửi từ client để yêu cầu ký (event /get_aa)
export const MOCK_DEVICE_AA_REQUEST = {
  clientId: "client_demo_1",
  challenge: "Y2hhbGxlbmdlX2RlbW8=",
};

// Phản hồi khi ký thành công (id: 7)
export const MOCK_DEVICE_AA_RESPONSE = {
  id: 7,
  data: {
    aa_signature: "c2lnbmF0dXJlX2FhX2RlbW8=",
    aa_challege: "Y2hhbGxlbmdlX2RlbW8=",
  },
};

/** 1.4 Đọc lại thông tin thẻ (Re-read) */

// Lệnh gửi từ client để đọc lại (event /input_data)
export const MOCK_DEVICE_REREAD_REQUEST = {
  idCode: MOCK_USERS[0].id_number,
  dateOfBirth: "15051990",
  expiryDate: "15052030",
  clientId: "client_demo_1",
};

/** 2. Service Đọc Webcam */

// Lắng nghe dữ liệu (event /image)
export const MOCK_WEBCAM_IMAGE_EVENT = {
  data: MOCK_SELFIE_BASE64,
};
