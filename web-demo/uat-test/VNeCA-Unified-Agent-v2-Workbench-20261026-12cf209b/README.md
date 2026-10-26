# Unified Agent v2 session workbench

Mở **[QUICK-START-VI.md](QUICK-START-VI.md)** trước. Import hai collection và đúng environment; gửi từng bước bằng Send, không Runner. **[READINESS-MATRIX.md](READINESS-MATRIX.md)** phân biệt runtime hiện tại, supported contract, controlled tests và authority còn thiếu. **[CONTRACT-RECOVERY.md](CONTRACT-RECOVERY.md)** giải thích key/replay/continuation và A–L; **[OPERATOR-GUIDE.md](OPERATOR-GUIDE.md)** tách provisioning khỏi customer. **[VERIFY-RESULT.md](VERIFY-RESULT.md)** hướng dẫn verify độc lập.

`samples/START-*.template.json` là full public body minh họa, có placeholder chưa phải danh tính/authorization. Collection dựng body từ Vault và khóa tự động, không yêu cầu sửa JSON theo từng response. Không Send template chưa điền signer hợp lệ. Input mẫu không nhạy cảm, không là bằng chứng certificate ownership.

Development (repo Node24, lockfile có sẵn):

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run generate
npm test
```

Generate dùng validator shipping đã build trong `sdk/server-agent/dist/unified`, không tải remote code vào Postman. Built-in Postman `crypto-js` chỉ dùng checksum. Java verifier và PDFBox/BC độc lập không dùng engine ký Agent. `node_modules` và verifier binary không commit. ZIP đã kiểm SHA256 mỗi source entry và SHA512 dependency; included PDFBox LICENSE/NOTICE. Không chứa secret hoặc authority ký.

Maintainer pack, dùng public jar đã pin:

```powershell
./pack.ps1 -PdfBoxJar C:/verified/pdfbox-app-3.0.8.jar -Destination C:/deliverables/VNeCA-Unified-v2-workbench-NEWVERSION.zip
```

Actual runtime read-only evidence và test summary ở `evidence/`. Schema/unit/controlled crypto PASS không thay Real Provider UAT. Bộ không renew grant, không activate/cohort, không tự START.
