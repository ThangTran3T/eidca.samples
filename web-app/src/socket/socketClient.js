/**
 * socketClient.js
 * SocketIO client kết nối đầu đọc thẻ CCCD (NFC Reader) và webcam thật.
 *
 * Thiết bị:
 *  - NFC Reader 3TE4/HN212 → https://192.168.5.1:8000
 *  - Webcam service        → https://192.168.5.1:9000
 *
 * Events NFC nhận từ server (qua event '/event'):
 *  id:2 → getPersonalInfo  (thông tin text CCCD)
 *  id:4 → getAvatarImage   (ảnh + raw NFC data)
 *  id:5 → getDSCert        (DS_CERT)
 *  id:3 → getErrorInfo     (lỗi đọc thẻ)
 *  id:7 → getSignalInfo    (kết quả ký AA)
 *
 * Events NFC gửi lên server:
 *  /get_aa    → Ký Active Authentication với challenge
 *  /input_data → Re-read thẻ
 *
 * Events Webcam:
 *  /image → Stream ảnh Base64 liên tục
 *
 * ⚠️ Cùng interface (socket.on) với mockSocket.js để swap linh hoạt.
 */

import { io } from "socket.io-client";

export function createRealSocket() {
  const NFC_URL = import.meta.env.VITE_SOCKET_NFC_URL || "https://192.168.5.1:8000";
  const CAM_URL = import.meta.env.VITE_SOCKET_CAM_URL || "https://192.168.5.1:9000";

  let nfcSocket = null;
  let camSocket = null;
  const _clientId = "web_client_" + Date.now();

  // ── Callbacks object — cùng interface với mockSocket ────────────────────
  const on = {
    nfcConnect:    () => {},
    nfcDisconnect: () => {},
    deviceInfo:    () => {},
    personalInfo:  () => {},
    avatarImage:   () => {},
    dsCert:        () => {},
    cardError:     () => {},
    aaResponse:    () => {},
    camConnect:    () => {},
    camDisconnect: () => {},
    webcamFrame:   () => {},
  };

  function _connectNfc() {
    nfcSocket = io(NFC_URL, {
      transports: ["websocket"],
      rejectUnauthorized: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    nfcSocket.on("connect",    () => on.nfcConnect());
    nfcSocket.on("disconnect", () => on.nfcDisconnect());
    nfcSocket.on("/info",      (data) => on.deviceInfo(data));

    // Dispatch card events theo id
    nfcSocket.on("/event", (data) => {
      switch (data.id) {
        case 2: on.personalInfo(data); break;
        case 4: on.avatarImage(data);  break;
        case 5: on.dsCert(data);       break;
        case 3: on.cardError(data);    break;
        case 7: on.aaResponse(data);   break;
      }
    });
  }

  function _connectCam() {
    camSocket = io(CAM_URL, {
      transports: ["websocket"],
      rejectUnauthorized: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    camSocket.on("connect",    () => on.camConnect());
    camSocket.on("disconnect", () => on.camDisconnect());
    camSocket.on("/image",     (data) => on.webcamFrame(data));
  }

  return {
    on,

    connect() {
      _connectNfc();
      _connectCam();
    },

    disconnect() {
      nfcSocket?.disconnect();
      camSocket?.disconnect();
    },

    /**
     * Ký Active Authentication trên chip thẻ CCCD.
     * Kết quả trả về qua on.aaResponse (event /event với id:7).
     * @param {string} challenge - Base64 challenge từ eIDCA API
     */
    sendAA(challenge) {
      if (!nfcSocket?.connected) {
        console.error("[SocketClient] NFC chưa kết nối");
        return;
      }
      nfcSocket.emit("/get_aa", { clientId: _clientId, challenge });
    },

    /**
     * Re-read thẻ đang đặt trên đầu đọc.
     * @param {{ idCode, dateOfBirth, expiryDate }} cardInfo
     */
    sendReRead(cardInfo) {
      if (!nfcSocket?.connected) return;
      nfcSocket.emit("/input_data", { ...cardInfo, clientId: _clientId });
    },

    get isNfcConnected() { return nfcSocket?.connected ?? false; },
    get isCamConnected() { return camSocket?.connected ?? false; },
  };
}
