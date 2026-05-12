# Tài liệu Tích hợp Thiết bị (Device Reference)

Tài liệu này mô tả các phương thức kết nối và giao tiếp với các thiết bị ngoại vi (đầu đọc thẻ CCCD, webcam) thông qua giao thức Socket.IO.

## 1. Service Đọc Thẻ Căn Cước Công Dân (CCCD)

**Kết nối:**
- **Giao thức:** Socket.IO
- **Địa chỉ IP:** `https://192.168.5.1:8000`

### 1.1. Lấy thông tin thiết bị
Lấy thông tin thiết bị qua event `/info` ngay khi kết nối Socket.IO thành công.

- **Dữ liệu nhận được (getInfoDevice):**
```json
{
    "version": "1.1",
    "serial_nfc": "00123000012",
    "serial_device": "0022300111",
    "date": "2026-05-12T02:39:59.852Z"
}
```

### 1.2. Sự kiện đọc thẻ (Card Insert)
Đọc dữ liệu thông qua event `/event` khi cắm/đặt thẻ căn cước vào thiết bị. Có các trường hợp phản hồi dữ liệu như sau:

#### A. Đọc thẻ thành công - Lấy dữ liệu Text (id: 2)
- **Dữ liệu nhận được (getPersonalInfo):**
```json
{
    "id": 2,
    "message": "read card successfully!",
    "data": {
        "idCode": "{String}", // Số căn cước (12 số)
        "oldIdCode": "{String}", // Số chứng minh nhân dân cũ (9 số)
        "personName": "{String}", // Họ tên
        "dateOfBirth": "{String}", // Ngày sinh
        "gender": "{String}", // Giới tính
        "nationality": "{String}", // Quốc tịch
        "race": "{String}", // Dân tộc
        "religion": "{String}", // Tôn giáo
        "originPlace": "{String}", // Quê quán
        "residencePlace": "{String}", // Địa chỉ thường trú
        "personalIdentification": "{String}", // Đặc điểm nhận dạng
        "issueDate": "{String}", // Ngày phát hành thẻ
        "expiryDate": "{String}", // Ngày hết hạn
        "fatherName": "{String}", // Họ tên bố
        "motherName": "{String}", // Họ tên mẹ
        "wifeName": "{String}", // Họ tên vợ/chồng (nếu có)
        "qr": "{String}" // Thông tin đọc từ mã QR trên CCCD
    }
}
```

#### B. Đọc thẻ thành công - Lấy dữ liệu Ảnh & Raw Phân vùng (id: 4)
- **Dữ liệu nhận được (getAvatarImage):**
```json
{
    "id": 4,
    "data": {
        "img_data": "{Base64 string}", // Ảnh chân dung
        "dg1": "{Base64 string}", // Dữ liệu raw phân vùng DG1
        "dg2": "{Base64 string}", // Dữ liệu raw phân vùng DG2
        "dg13": "{Base64 string}", // Dữ liệu raw phân vùng DG13
        "dg14": "{Base64 string}", // Dữ liệu raw phân vùng DG14
        "dg15": "{Base64 string}", // Dữ liệu raw phân vùng DG15
        "sod": "{Base64 string}" // Dữ liệu raw phân vùng SOD
    }
}
```

#### C. Đọc thẻ thành công - Tách chuỗi DS_CERT (id: 5)
- **Dữ liệu nhận được (getDSCert):**
```json
{
    "id": 5,
    "data": {
        "CA": "1",
        "AA": {
            "aa_signature": ""
        },
        "PA": {
            "hash_dg1": "{Base64 string}", // Mã hash DG1
            "hash_dg2": "{Base64 string}", // Mã hash DG2
            "hash_dg13": "{Base64 string}", // Mã hash DG13
            "hash_dg14": "{Base64 string}", // Mã hash DG14
            "hash_dg15": "{Base64 string}", // Mã hash DG15
            "cert": "{Base64 string}", // Mã DS_CERT tách từ SOD
            "sod": "{Base64 string}" // Mã SOD
        }
    }
}
```

#### D. Quét thẻ thất bại (id: 3)
- **Dữ liệu nhận được (getErrorInfo):**
```json
{
    "id": 3,
    "message": "{String}" // Thông tin lỗi chi tiết
}
```

### 1.3. Ký số trên thẻ Căn cước (Active Authentication)
Thực hiện ký số (AA) với thẻ đang cắm trong đầu đọc.
- **Gửi lệnh qua event `/get_aa` với dữ liệu (sendSignalMessage):**
```json
{
    "clientId": "{String}", // Mã Client kết nối
    "challenge": "{Base64 string}" // Mã thử thách (8 byte)
}
```
- **Nhận thông tin ký thành công (getSignalInfo) - (id: 7):**
```json
{
    "id": 7,
    "data": {
        "aa_signature": "{Base64 string}", // Chữ ký số từ chip tương ứng với mã thử thách
        "aa_challege": "{Base64 string}" // Mã thử thách (challenge) gửi đi
    }
}
```

### 1.4. Đọc lại thông tin thẻ (Re-read)
Thực hiện đọc, lấy lại thông tin từ thẻ Căn cước đang đặt tại thiết bị. 
> **Lưu ý:** `idCode`, `dateOfBirth` và `expiryDate` phải chính xác với thẻ căn cước đang cắm trên thiết bị. Đối với thẻ không có hạn sử dụng, trường `expiryDate` được tính bằng cách lấy `ddmm` của `dateOfBirth` ghép với năm `2099` (ddmm2099).

- **Gửi lệnh qua event `/input_data` với dữ liệu (sendReRead):**
```json
{
    "idCode": "{String}", // Số thẻ căn cước
    "dateOfBirth": "{string}", // Ngày sinh (Định dạng: ddmmyyyy)
    "expiryDate": "{string}", // Ngày hết hạn (Định dạng: ddmmyyyy)
    "clientId": "1" // ID của client khi kết nối Socket.IO
}
```
- **Nhận lại thông tin:** Sau khi gửi lệnh, thiết bị sẽ phản hồi lại thông tin qua các event giống với sự kiện đọc thẻ (id 2, 4, 5).

---

## 2. Service Đọc Webcam

Service đọc ảnh webcam cho phép nhận luồng ảnh liên tục từ camera.

**Kết nối:**
- **Giao thức:** Socket.IO
- **Địa chỉ IP:** `https://192.168.5.1:9000`

### 2.1. Nhận dữ liệu hình ảnh
Client lắng nghe event `/image` để nhận dữ liệu frame ảnh từ webcam.

- **Dữ liệu nhận được (getFaceImage):**
```json
{
    "data": "{Base64 string}" // Dữ liệu ảnh camera dưới dạng Base64
}
```
