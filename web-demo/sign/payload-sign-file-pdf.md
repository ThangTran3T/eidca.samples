# Example Payload for Signing PDF Document
- Url: http://127.0.0.1:23456/api/sign-document
- Method: POST
- Payload:
``` json
{
    "pdf_base64": "base64_encode(pdf_file)", // (Bắt buộc) File PDF dưới dạng Base64
    "method_code": "ANY",             // (Bắt buộc) Mã phương thức ký (USB_TOKEN, CCCD_NFC)
    "user_id": "034080001405",         // (Tùy chọn) Định danh người dùng để lưu vết
    "id_number":"034080001405",  // (Bắt buộc) Số CCCD 
    "sign_props":"[{\"page\":1,\"lLx\":47,\"lLy\":693,\"width\":167,\"height\":95,\"template\":\"text_only\",\"show_info\":[\"reason\",\"location\",\"contact\",\"name\",\"org\",\"date\"],\"location\":\"H\\u00e0 N\\u1ed9i\",\"location_label\":\"T\\u1ea1i: Ph\\u00f2ng giao d\\u1ecbch\",\"reason\":\"K\\u00fd h\\u1ee3p \\u0111\\u1ed3ng \\u0111i\\u1ec7n t\\u1eed\",\"reason_label\":\"Nguy\\u1ec5n V\\u0103n A\",\"contact\":\"Gi\\u00e1m \\u0111\\u1ed1c\",\"contact_label\":\"\",\"date_label\":\"Ng\\u00e0y k\\u00fd\",\"text_color\":\"#ff0033\",\"font_size\":11,\"sign_visibility\":\"shown\",\"watermark_pos\":\"center\",\"watermark_img_b64\":\"\",\"hand_sig_img_b64\":\"\"}]"// Chữ ký mẫu
}
```
- Response:
``` json
{
    "status": "SUCCESS", // Trạng thái ký
    "transaction_id": "ist_f3bf599cdc3e4cb29f349ad1dc4bc96c", // Mã giao dịch
    "signed_pdf_base64": "base64_encode(signed_pdf_file)" // file pdf đã ký
}
```