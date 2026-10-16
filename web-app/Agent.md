# Agent.md — Web App Integration Example

> **Dành cho AI Agent**: File này cung cấp toàn bộ context cần thiết để làm việc hiệu quả trong project `web-app`.
> Sử dụng tài liệu từ file `device-reference.md` để hiểu rõ các events và cách dùng SocketIO Bridge Service.
> Sử dụng tài liệu từ file `api-reference.md` để hiểu rõ các API calls và cách dùng của eIDCA API.

---

## 🎯 Mục đích Project

Dự án mẫu hướng dẫn tích hợp **eIDCA ký số từ xa** vào **ứng dụng Web** (trình duyệt). Người dùng dùng đầu đọc thẻ vật lý (3TE4 hoặc HN212) kết nối USB, ứng dụng web giao tiếp với đầu đọc qua **SocketIO**, và gọi **eIDCA REST API** để đăng ký và thực hiện ký số. Có **Mock Mode** dùng local mock server để phát triển không cần phần cứng thật.

---

## 🗂️ Cấu trúc thư mục (thực tế)

```
web-app/
├── Agent.md                        ← File này (context cho AI Agent)
├── README.md                       ← Hướng dẫn cài đặt & chạy demo
├── package.json                    ← Dependencies: socket.io-client, vite
├── vite.config.js                  ← Vite dev server + proxy /ca → localhost:3001
├── .env                            ← Biến môi trường (không commit)
├── .env.example                    ← Template biến môi trường
├── index.html                      ← HTML shell (chỉ có <div id="app">)
└── src/
    ├── main.js                     ← Entry point: bootstrap, router, layout
    ├── app.css                     ← Design system CSS (dark theme, components)
    ├── api/
    │   └── eidcaClient.js          ← HTTP client cho 4 flows (fetch, đọc config từ localStorage)
    ├── socket/
    │   ├── socketClient.js         ← Real SocketIO client (NFC + Webcam thật)
    │   └── mockSocket.js           ← Mock socket giả lập NFC + Webcam
    ├── ui/
    │   ├── ModeToggle.js           ← Toggle Mock/Live, lưu config vào localStorage
    │   ├── DevicePanel.js          ← Sidebar: trạng thái NFC/Webcam, preview ảnh, CCCD info
    │   └── CodePanel.js            ← Hiển thị JSON Request/Response song song (như Postman)
    └── flows/
        ├── personal-onboarding/    ← Luồng Đăng ký CTS Cá nhân (3 bước)
        │   ├── index.js            ← mountPersonalOnboarding(), router, state, socket chaining
        │   ├── Step1Challenge.js   ← POST /eid-personal/challenge
        │   ├── Step2Signature.js   ← POST /eid-personal/signature (NFC + AA + selfie)
        │   └── Step3Check.js       ← POST /eid-personal/check (polling)
        ├── personal-sign/          ← Luồng Ký số Cá nhân (3 bước)
        │   ├── index.js            ← mountPersonalSign(), router, state, socket chaining
        │   ├── Step1Upload.js      ← POST /sign/challenge (multipart upload PDF)
        │   ├── Step2Signature.js   ← POST /sign/signature (doc AA + selfie)
        │   └── Step3Download.js    ← GET /sign/download/{doc-id} (polling + download)
        ├── company-onboarding/     ← Luồng Đăng ký CTS Cá nhân thuộc Tổ chức (3 bước)
        │   ├── index.js            ← mountCompanyOnboarding(), tương tự personal nhưng có company_id
        │   ├── Step1Challenge.js   ← POST /eid-company/challenge (+ company_id)
        │   ├── Step2Signature.js   ← POST /eid-company/signature
        │   └── Step3Check.js       ← POST /eid-company/check (polling)
        └── company-sign/           ← Luồng Ký số Cá nhân thuộc Tổ chức (3 bước)
            ├── index.js            ← mountCompanySign(), dùng chung Step3Download từ personal-sign
            ├── Step1Upload.js      ← POST /sign-company/challenge (+ company_id)
            └── Step2Signature.js   ← POST /sign-company/signature
```

---

## 🔧 Stack kỹ thuật

| Thành phần | Công nghệ | Ghi chú |
|-----------|-----------|---------|
| UI | Vanilla JS (ES Modules) | Không dùng framework |
| Styling | Vanilla CSS | Dark theme, design tokens |
| HTTP Client | `fetch` (native) | Không dùng axios |
| WebSocket | `socket.io-client ^4.8.1` | Kết nối NFC Reader + Webcam |
| Build Tool | Vite `^5.4.0` | Dev server port 5173 |
| Mock Server | `node ../mock/mock-server.js` | Script riêng ngoài web-app |

---

## ⚙️ Biến môi trường (.env)

```env
# Chọn chế độ: "mock" hoặc "live"
VITE_APP_MODE=mock

# Mock Mode
VITE_MOCK_API_URL=http://localhost:3001
VITE_MOCK_API_KEY=MOCK_API_KEY_DEMO
VITE_MOCK_PARTNER_CODE=PARTNER_DEMO_001

# Live Mode
VITE_EIDCA_API_BASE_URL=https://api.eidca.vn
VITE_EIDCA_API_KEY=your_api_key_here
VITE_EIDCA_PARTNER_CODE=your_partner_code_here

# Socket (đầu đọc NFC + Webcam)
VITE_SOCKET_NFC_URL=https://192.168.5.1:8000
VITE_SOCKET_CAM_URL=https://192.168.5.1:9000

VITE_APP_NAME=eIDCA Web Demo
```

> **Lưu ý**: Các biến VITE_* **không được đọc trực tiếp** trong runtime. Config được đọc từ `localStorage` (lưu bởi `ModeToggle`). File `.env` chỉ dùng làm tài liệu tham khảo mặc định.

---

## 🔄 Kiến trúc Runtime

### Config & Mode (ModeToggle → localStorage)

```
ModeToggle (UI) → lưu config vào localStorage["eidca_demo_config"]
                → eidcaClient.js đọc mỗi lần gọi API
                → main.js tạo lại socket khi đổi mode
```

Config object: `{ isMock: bool, apiUrl: string, apiKey: string, partnerCode: string }`

### Vite Proxy (Mock Mode)

```
Browser → fetch("/ca/api/...")
        → Vite proxy chuyển tiếp → http://localhost:3001/ca/api/...
```

Cấu hình trong `vite.config.js`: proxy path `/ca` → `http://localhost:3001`

### Socket Interface

Cả `socketClient.js` và `mockSocket.js` đều expose **cùng một interface** (`socket.on.*` callbacks + methods), cho phép swap linh hoạt giữa mock và real mà không cần thay đổi code flow.

---

## 📡 Socket Events

### NFC Reader (`socketClient.js` / `mockSocket.js`)

**Callbacks (gán vào `socket.on.*`):**

| Callback | Trigger | Data |
|----------|---------|------|
| `on.nfcConnect` | Kết nối thành công | — |
| `on.nfcDisconnect` | Mất kết nối | — |
| `on.deviceInfo` | Event `/info` | `{ version, serial_nfc, serial_device, date }` |
| `on.personalInfo` | Event `/event` id:2 | `{ id:2, data: { idCode, personName, dateOfBirth, gender, ... } }` |
| `on.avatarImage` | Event `/event` id:4 | `{ id:4, data: { img_data, dg1, dg2, dg13, dg14, dg15, sod } }` |
| `on.dsCert` | Event `/event` id:5 | `{ id:5, data: { CA, AA, PA } }` |
| `on.cardError` | Event `/event` id:3 | `{ id:3, message }` |
| `on.aaResponse` | Event `/event` id:7 | `{ id:7, data: { aa_signature, aa_challege } }` |

**Methods:**

| Method | Mô tả |
|--------|-------|
| `socket.sendAA(challenge)` | Gửi lệnh ký Active Authentication lên chip thẻ. Kết quả về qua `on.aaResponse` |
| `socket.sendReRead(cardInfo)` | Re-read thẻ đang đặt trên đầu đọc (chỉ real socket) |
| `socket.connect()` | Kết nối NFC + Webcam |
| `socket.disconnect()` | Ngắt kết nối |
| `socket.pauseCam()` | Tạm dừng webcam stream |
| `socket.resumeCam()` | Resume webcam stream |
| `socket.simulateCardRead()` | (Chỉ mock) Kích hoạt giả lập đọc thẻ thủ công |

### Webcam (`socketClient.js` / `mockSocket.js`)

| Callback | Trigger | Data |
|----------|---------|------|
| `on.camConnect` | Webcam kết nối | — |
| `on.camDisconnect` | Webcam mất kết nối | — |
| `on.webcamFrame` | Stream `/image` (~5fps) | `{ data: "<Base64 JPEG>" }` |

### Mock Timings

| Sự kiện | Delay |
|---------|-------|
| NFC connect | 600ms sau `connect()` |
| Webcam connect | 800ms sau `connect()` |
| `personalInfo` (id:2) | +800ms sau NFC connect |
| `avatarImage` (id:4) | +600ms sau personalInfo |
| `dsCert` (id:5) | +400ms sau avatarImage |
| `aaResponse` (id:7) | 500ms sau `sendAA()` |
| Webcam frames | Mỗi 200ms (5fps) |

---

## 🔀 Luồng 1 — Đăng ký CTS Cá nhân (`/personal-onboarding`)

**Route**: `/personal-onboarding` → `mountPersonalOnboarding()`

**State dùng chung:**
```js
{
  partnerCode,       // từ config
  idNumber,          // từ CCCD NFC (id:2)
  transactionCode,   // STEP 1 output
  challenge,         // STEP 1 output (Base64, dùng để ký AA)
  tokenChallenge,    // STEP 1 output (JWT)
  rawData,           // từ NFC id:4: { sod, dg1, dg2, dg13, dg15 }
  signature,         // aa_signature từ chip (id:7)
  selfieBase64,      // ảnh webcam (frame đầu tiên nhận được)
  tokenSignature,    // STEP 2 output
  interval,          // STEP 2 output (polling interval ms)
}
```

**3 bước:**
```
STEP 1 (Step1Challenge.js)
  └── POST /ca/api/eid-personal/challenge
      Body: { code, id_number }
      → { transaction_code, challenge, token_challenge }

STEP 2 (Step2Signature.js)
  ├── Đặt thẻ → socket nhận id:4 → rawData
  ├── socket.sendAA(challenge) → nhận id:7 → aa_signature
  ├── Chụp selfie từ webcam (frame đầu tiên)
  └── POST /ca/api/eid-personal/signature
      Body: { code, transaction_code, token_challenge, raw_data{sod,dg1,dg2,dg13,dg15}, info{...}, signature }
      → { transaction_code, status, interval, expired_at, token_signature }

STEP 3 (Step3Check.js)
  └── POST /ca/api/eid-personal/check  [poll mỗi interval ms]
      Body: { code, transaction_code, token_signature }
      → { status: "processing"|"completed"|"failed", cert_info? }
```

---

## 🔀 Luồng 2 — Ký số Cá nhân (`/personal-sign`)

**Route**: `/personal-sign` → `mountPersonalSign()`

**State dùng chung:**
```js
{
  partnerCode,       // từ config
  idNumber,          // từ CCCD NFC (id:2)
  transactionCode,   // STEP 1 output
  tokenSign,         // STEP 1 output
  docs,              // STEP 1 output: [{ doc_id, doc_name, doc_challenge }]
  selectedFile,      // File PDF upload
  aaSignature,       // STEP 2: aa_signature từ chip
  selfieBase64,      // ảnh webcam
  signedDocs,        // STEP 2 output: [{ doc_id, doc_name, ca_signature, sign_at, doc_hash }]
  tokenSigned,       // STEP 2 output: token để download
}
```

**3 bước:**
```
STEP 1 (Step1Upload.js)
  └── POST /ca/api/sign/challenge  [multipart/form-data]
      Headers: { x-api-key, code }
      Body (FormData): documents (File), id_number, sign_props (JSON), security_level
      → { transaction_code, token_sign, docs[{doc_id, doc_name, doc_challenge}] }

STEP 2 (Step2Signature.js)
  ├── socket.sendAA(docs[0].doc_challenge) → id:7 → aa_signature
  ├── Chụp selfie từ webcam
  └── POST /ca/api/sign/signature
      Body: { code, transaction_code, token_sign, info:{image}, doc_signs:[{doc_id, signature}] }
      → { status, token, signed_docs[], interval, expired_at }

STEP 3 (Step3Download.js)
  ├── Poll trạng thái qua signed_docs[].status
  └── GET /ca/api/sign/download/{doc-id}
      Headers: { x-api-key, code, transaction-code, token-sign, os-type:"Web" }
      → Blob (PDF file)
```

> **Lưu ý**: Step2 của personal-sign **không cần gửi raw NFC data** (sod, dg1...). Chỉ cần selfie + doc_signs.

---

## 🔀 Luồng 3 — Đăng ký CTS Cá nhân thuộc Tổ chức (`/personal-company-onboarding`)

**Route**: `/personal-company-onboarding` → `mountCompanyOnboarding()`

Tương tự Luồng 1 nhưng khác biệt:
- **STEP 1**: Thêm tham số `company_id`, dùng endpoint `/eid-company/challenge`
- **STEP 2**: Payload gọn hơn (chỉ `phone`, `email`, `image`), endpoint `/eid-company/signature`
- **STEP 3**: Endpoint `/eid-company/check`

```
STEP 1 → POST /ca/api/eid-company/challenge
  Body: { code, id_number, company_id }
  → { transaction_code, token_challenge }   ← Không có trường "challenge" riêng

STEP 2 → POST /ca/api/eid-company/signature
  Body: { code, transaction_code, token_challenge, raw_data, info, signature }

STEP 3 → POST /ca/api/eid-company/check  [poll]
  Body: { code, transaction_code, token_signature }
```

---

## 🔀 Luồng 4 — Ký số Cá nhân thuộc Tổ chức (`/personal-company-sign`)

**Route**: `/personal-company-sign` → `mountCompanySign()`

Tương tự Luồng 2 nhưng khác biệt:
- **STEP 1**: Thêm `company_id`, dùng endpoint `/sign-company/challenge`
- **STEP 2**: Endpoint `/sign-company/signature`
- **STEP 3**: Dùng **chung** `Step3Download.js` từ `personal-sign/` (endpoint `/sign/download/{doc-id}` không đổi)

```
STEP 1 → POST /ca/api/sign-company/challenge  [multipart]
  Headers: { x-api-key, code }
  Body (FormData): documents, id_number, company_id, sign_props, security_level

STEP 2 → POST /ca/api/sign-company/signature
  Body: { code, transaction_code, token_sign, info:{image}, doc_signs:[{doc_id, signature}] }

STEP 3 → GET /ca/api/sign/download/{doc-id}   ← Endpoint chung với Luồng 2
```

---

## 🧩 Các Component UI chính

### `main.js` — Bootstrap & Router

- Khởi tạo HTML layout: header, nav tabs, sidebar, main-content.
- Mount `ModeToggle` và `DevicePanel` vào sidebar.
- Tạo socket (mock hoặc real) theo config ban đầu.
- Client-side router: map route → `mount*()` function.
- Khi đổi mode: disconnect socket cũ → tạo socket mới → mount lại route hiện tại.
- Truyền vào mỗi flow: `{ socket, modeConfig, getFrame, pauseWebcam, resumeWebcam }`.

**Routes:**
```js
{ path: "/personal-onboarding",       label: "Đăng ký CTS Cá nhân",     mount: mountPersonalOnboarding }
{ path: "/personal-sign",             label: "Ký số Cá nhân",            mount: mountPersonalSign }
{ path: "/personal-company-onboarding", label: "Đăng ký CTS Tổ chức",   mount: mountCompanyOnboarding }
{ path: "/personal-company-sign",     label: "Ký số Tổ chức",            mount: mountCompanySign }
```

### `ModeToggle.js`

- Toggle switch chuyển Mock/Live.
- Mock mode: hiển thị API URL `localhost:3001` và key mặc định.
- Live mode: form nhập `API Base URL`, `API Key (x-api-key)`, `Partner Code`.
- Lưu config vào `localStorage["eidca_demo_config"]`.
- Callback `onChange(config)` → main.js rebuild socket và reload route.

### `DevicePanel.js`

- Sidebar panel: trạng thái NFC (dot indicator + serial number), trạng thái Webcam, preview ảnh webcam live, card info (tên + số CCCD).
- `getCurrentFrame()` → Base64 frame mới nhất (dùng để chụp selfie).
- `updateSocket(newSocket)` → gán lại khi đổi mode.
- `pauseWebcam()` / `resumeWebcam()` → pause/resume stream.
- `setMode(isMock)` → cập nhật badge Mock/Live.

### `CodePanel.js`

- `renderCodePanels(container, { requestTitle, responseTitle })` → render 2 panel song song.
- Returns: `{ setRequest(obj), setResponse(obj, state), setLoading(), el }`.
- `state`: `"success"` | `"error"` | `"processing"` → màu title thay đổi.
- Nút Copy để copy JSON ra clipboard.
- Syntax highlight JSON với `highlightJSON(value)`.

### `eidcaClient.js` — API Functions

**Flow 1 — CTS Cá nhân: Đăng ký:**
- `personalGetChallenge(idNumber)` → POST `/ca/api/eid-personal/challenge`
- `personalSendSignature({ transactionCode, tokenChallenge, rawData, info, signature })` → POST `/ca/api/eid-personal/signature`
- `personalCheckStatus(transactionCode, tokenSignature)` → POST `/ca/api/eid-personal/check`

**Flow 2 — CTS Cá nhân: Ký văn bản:**
- `signGetChallenge(formData)` → POST `/ca/api/sign/challenge` (multipart)
- `signSendSignature({ transactionCode, tokenSign, selfieBase64, docSigns })` → POST `/ca/api/sign/signature`
- `downloadSignedDoc(docId, transactionCode, tokenSign)` → GET `/ca/api/sign/download/{docId}` → `Blob`

**Flow 3 — CTS Tổ chức: Đăng ký:**
- `companyGetChallenge(idNumber, companyId)` → POST `/ca/api/eid-company/challenge`
- `companySendSignature({ transactionCode, tokenChallenge, rawData, info, signature })` → POST `/ca/api/eid-company/signature`
- `companyCheckStatus(transactionCode, tokenSignature)` → POST `/ca/api/eid-company/check`

**Flow 4 — CTS Tổ chức: Ký văn bản:**
- `signCompanyGetChallenge(formData)` → POST `/ca/api/sign-company/challenge` (multipart)
- `signCompanySendSignature(params)` → POST `/ca/api/sign-company/signature`

---

## 🔗 Socket Callback Chaining Pattern

Mỗi flow cần lắng nghe socket events nhưng `DevicePanel` cũng đã gán callbacks. Giải pháp: **chain callbacks** — lưu callback cũ trước khi override:

```js
// Trong flow/index.js
const _prevPersonalInfo = socket.on.personalInfo;  // Lưu callback của DevicePanel
socket.on.personalInfo = (event) => {
  _prevPersonalInfo(event);  // Gọi DevicePanel trước
  // Xử lý logic của flow...
  state.idNumber = event.data?.idCode;
  step1.setIdFromCard(state.idNumber);
};
```

**Thứ tự chaining:** DevicePanel → Flow index.js → Step components (activate() gán aaResponse).

---

## 📌 Quy ước code

- **Ngôn ngữ comments**: Tiếng Việt cho nghiệp vụ, Tiếng Anh cho kỹ thuật.
- **Module system**: ES Modules (`import`/`export`), `"type": "module"` trong package.json.
- **State management**: Plain object truyền tham chiếu giữa index.js và step components.
- **Error handling**: Luôn wrap API call trong `try/catch`, hiển thị lỗi lên CodePanel + badge.
- **Selfie**: Lấy frame đầu tiên từ webcam stream. Sau khi set → `pauseWebcam()` để giữ ảnh. Nút "Chụp lại" → `resumeWebcam()` + reset.
- **Polling (Step3)**: Poll mỗi `state.interval` ms, tối đa 100 lần, dừng khi `status === "completed"` hoặc `"failed"`.

---

## 🐛 Các vấn đề thường gặp

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| Flow không nhận NFC data khi chuyển tab | Socket callbacks bị override khi mount flow mới | Đã xử lý bằng chaining pattern |
| Step2 NFC data bị empty | Mock: bỏ lỡ sự kiện khởi động | Gọi `socket.simulateCardRead()` hoặc click "Retry" |
| Selfie luôn là ảnh cũ | `_lastFrame` chưa được clear sau resumeWebcam | `DevicePanel.resumeWebcam()` đã clear `_lastFrame` |
| CORS khi gọi API Live | Origin chưa được whitelist | Thêm domain vào whitelist eIDCA |
| Vite proxy không hoạt động | Mock server chưa chạy | Chạy `npm run mock` trước |
| `card:data` trả về empty | Thẻ CCCD đặt sai vị trí | Nhắc user đặt lại thẻ |
| Company flow challenge không có `challenge` field | `/eid-company/challenge` không trả về trường `challenge` riêng | Challenge lấy từ `token_challenge` (JWT chứa bên trong) |

---

## 🚀 Khởi động nhanh

```bash
# Trong thư mục web-app/
npm install

# Terminal 1: Mock server
npm run mock        # node ../mock/mock-server.js → localhost:3001

# Terminal 2: Dev server
npm run dev         # Vite → localhost:5173
```

Mở trình duyệt: **http://localhost:5173** → Chọn Mock Mode → chọn luồng.

---

## 📚 Tài liệu tham khảo

- `../docs/api-reference.md` — eIDCA API Reference (tất cả endpoints, request/response schema)
- `../docs/device-reference.md` — SocketIO Bridge Service (events, commands)
- `../mock/mock-server.js` — Mock HTTP server cho API
- `../mock/mock-data.js` — Mock data tĩnh cho socket và API
- [socket.io-client docs](https://socket.io/docs/v4/client-api/)
- [Vite proxy config](https://vitejs.dev/config/server-options.html#server-proxy)
