/**
 * mockSocket.js
 * Giả lập toàn bộ SocketIO events từ đầu đọc CCCD và webcam.
 * Dùng trong Mock Mode — cùng interface với socketClient.js thật.
 *
 * Pattern: Socket expose object `on` chứa các callback có thể gán lại từ bên ngoài.
 *
 * Cách dùng:
 *   import { createMockSocket } from './mockSocket.js';
 *   const socket = createMockSocket();
 *
 *   // Gán callbacks (gán lại bất cứ lúc nào)
 *   socket.on.nfcConnect    = (info) => console.log('NFC connected', info);
 *   socket.on.personalInfo  = (event) => console.log('Card data', event);
 *   socket.on.webcamFrame   = (frame) => renderImage(frame.data);
 *
 *   socket.connect();          // Bắt đầu giả lập
 *   socket.sendAA(challenge);  // Ký challenge trên chip thẻ
 *   socket.disconnect();       // Dừng
 */

// ─── Mock data (từ mock/mock-data.js — inline để web app self-contained) ──────

const MOCK_DEVICE_INFO = {
  version: "1.1",
  serial_nfc: "00123000012",
  serial_device: "0022300111",
  date: new Date().toISOString(),
};

const MOCK_PERSONAL_INFO = {
  id: 2,
  message: "read card successfully!",
  data: {
    idCode: "001087012345",
    oldIdCode: "123456789",
    personName: "NGUYỄN VĂN AN",
    dateOfBirth: "15051990",
    gender: "Nam",
    nationality: "Việt Nam",
    race: "Kinh",
    religion: "Không",
    originPlace: "Hà Nội",
    residencePlace: "Số 1, Phố Huế, Hai Bà Trưng, Hà Nội",
    personalIdentification: "Sẹo nhỏ dưới mắt trái",
    issueDate: "20032021",
    expiryDate: "15052030",
    fatherName: "Nguyễn Văn B",
    motherName: "Trần Thị C",
    wifeName: "",
    qr: "001087012345|123456789|Nguyễn Văn An|15051990|Nam|Hà Nội|20032021",
  },
};

// Ảnh placeholder nhỏ (1x1 grey pixel Base64)
const PLACEHOLDER_IMG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const MOCK_AVATAR_DATA = {
  id: 4,
  data: {
    img_data: PLACEHOLDER_IMG,
    dg1:  "YTExMTExMTExMTExMTExMTExMTExMTE=",
    dg2:  "aW1hZ2VCYXNlNjRvZlBob3RvSW1hZ2U=",
    dg13: "ZGcxM0RhdGFFeHRlbmRlZEluZm9ybWF=",
    dg14: "ZGcxNERhdGFCYXNlNjQ=",
    dg15: "ZGcxNVJTQVB1YmxpY0tleURhdGFCYXM=",
    sod:  "TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2I=",
  },
};

const MOCK_DS_CERT = {
  id: 5,
  data: {
    CA: "1",
    AA: { aa_signature: "" },
    PA: {
      hash_dg1:  "aGFzaF9kZzE=",
      hash_dg2:  "aGFzaF9kZzI=",
      hash_dg13: "aGFzaF9kZzEz",
      hash_dg14: "aGFzaF9kZzE0",
      hash_dg15: "aGFzaF9kZzE1",
      cert: "MIIFaDCCBBCgAwIBAgIQ...",
      sod: "TUlJRHFEQ0NBcENnQXdJQkFnSVFRM2I=",
    },
  },
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Tạo mock socket instance.
 * Sau khi tạo, gán callbacks vào socket.on trước khi gọi connect().
 */
export function createMockSocket() {
  let _nfcConnected = false;
  let _camConnected = false;
  let _webcamInterval = null;
  let _cardTimers = [];

  // ── Callbacks object (public, có thể gán lại bất cứ lúc nào) ──────────────
  // Đây là điểm giao tiếp chính — bên ngoài gán callback vào đây
  const on = {
    nfcConnect:    () => {},  // (deviceInfo) → Khi NFC kết nối
    nfcDisconnect: () => {},  // () → Khi NFC mất kết nối
    deviceInfo:    () => {},  // (info) → Thông tin thiết bị
    personalInfo:  () => {},  // (event{id:2}) → Dữ liệu text CCCD
    avatarImage:   () => {},  // (event{id:4}) → Ảnh + raw NFC
    dsCert:        () => {},  // (event{id:5}) → DS_CERT
    cardError:     () => {},  // (event{id:3}) → Lỗi đọc thẻ
    aaResponse:    () => {},  // (event{id:7}) → Kết quả ký AA
    camConnect:    () => {},  // () → Khi webcam kết nối
    camDisconnect: () => {},  // () → Khi webcam mất kết nối
    webcamFrame:   () => {},  // (frameData) → Frame ảnh webcam
  };

  // ── Webcam stream giả lập ────────────────────────────────────────────────
  function _startWebcam() {
    _camConnected = true;
    on.camConnect();
    // Stream 5fps
    _webcamInterval = setInterval(() => {
      on.webcamFrame({ data: PLACEHOLDER_IMG });
    }, 200);
  }

  function _stopWebcam() {
    if (_webcamInterval) { clearInterval(_webcamInterval); _webcamInterval = null; }
    _camConnected = false;
    on.camDisconnect();
  }

  // ── Giả lập đọc thẻ: id:2 → id:4 → id:5 ────────────────────────────────
  function _simulateCardRead() {
    // Bước 1: thông tin text sau 800ms
    _cardTimers.push(setTimeout(() => {
      on.personalInfo(MOCK_PERSONAL_INFO);

      // Bước 2: ảnh + raw NFC sau thêm 600ms
      _cardTimers.push(setTimeout(() => {
        on.avatarImage(MOCK_AVATAR_DATA);

        // Bước 3: DS_CERT sau thêm 400ms
        _cardTimers.push(setTimeout(() => {
          on.dsCert(MOCK_DS_CERT);
        }, 400));
      }, 600));
    }, 800));
  }

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    /** Callbacks object — gán các hàm xử lý vào đây */
    on,

    /** Kết nối (giả lập device sẵn sàng sau 600ms) */
    connect() {
      // NFC ready sau 600ms
      _cardTimers.push(setTimeout(() => {
        _nfcConnected = true;
        on.nfcConnect();
        on.deviceInfo(MOCK_DEVICE_INFO);
        _simulateCardRead(); // Tự động giả lập đặt thẻ
      }, 600));

      // Webcam ready sau 800ms
      _cardTimers.push(setTimeout(_startWebcam, 800));
    },

    /** Ngắt kết nối */
    disconnect() {
      _nfcConnected = false;
      _cardTimers.forEach(clearTimeout);
      _cardTimers = [];
      _stopWebcam();
      on.nfcDisconnect();
    },

    pauseCam() {
      _stopWebcam();
    },

    resumeCam() {
      if (!_camConnected) {
        _startWebcam();
      }
    },

    /**
     * Gửi lệnh ký Active Authentication lên chip thẻ.
     * Tương đương: socket.emit('/get_aa', { clientId, challenge })
     * @param {string} challenge - Base64 challenge từ eIDCA API
     */
    sendAA(challenge) {
      // Giả lập chip ký sau 500ms
      setTimeout(() => {
        on.aaResponse({
          id: 7,
          data: {
            aa_signature: btoa(`MOCK_AA_SIG_${Date.now()}`),
            aa_challege:  challenge,
          },
        });
      }, 500);
    },

    get isNfcConnected() { return _nfcConnected; },
    get isCamConnected() { return _camConnected; },
  };
}
