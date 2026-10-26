# Independent verification

`save-result.mjs` chỉ decode artifact, kiểm SHA256 theo response và ghi file mới (`wx`); không kiểm chữ ký. `verify-result.ps1` dùng Java/PDFBox/BouncyCastle độc lập với engine Agent, compile source đi kèm, xác minh offline. Cần JDK21 và public certificate chain/CRL được chấp nhận riêng. ZIP kèm `verify/pdfbox-app-3.0.8.jar`, kiểm SHA512 trước chạy; repository không commit binary đó.

```powershell
./verify-result.ps1 -Format PDF -Artifact C:/protected/result.pdf -Original C:/protected/original.pdf -Leaf C:/approved/leaf.pem -TrustedRoots C:/approved/roots.pem -Intermediates C:/approved/intermediates.pem -Crls C:/approved/crls.pem -JavaHome 'C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot'
./verify-result.ps1 -Format CMS -Artifact C:/protected/result.cms -Original C:/protected/original.bin -Leaf C:/approved/leaf.pem -TrustedRoots C:/approved/roots.pem -Intermediates C:/approved/intermediates.pem -Crls C:/approved/crls.pem -JavaHome 'C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot'
./verify-result.ps1 -Format XML -Artifact C:/protected/result.xml -Original C:/protected/original.xml -Leaf C:/approved/leaf.pem -TrustedRoots C:/approved/roots.pem -Intermediates C:/approved/intermediates.pem -Crls C:/approved/crls.pem -JavaHome 'C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot'
```

PDF verifier giới hạn **một chữ ký PAdES-B-B**, kiểm strict parser, AcroForm/widget reachable, full-revision ByteRange/covered bytes, SubFilter/M/signed attributes/ESS exact selected cert/CMS signature, đối chiếu page/text với original và PKIX/full CRL offline `NO_FALLBACK`. Không tuyên bố general PAdES accreditation, multi-signature, LT/LTA hoặc rằng text/page equality thay thế mọi loại document comparison. CMS kiểm detached signature và exact bytes/cert. XML giới hạn enveloped root RSA-SHA256/canonical references với secure validation/DOCTYPE và external entity disabled. Unsupported structure/chain/CRL/selected-cert mismatch không được đổi thành PASS.

CRL bundle cần current full CRL cho **mỗi issuer cần revocation** trong chain; không network OCSP/CRLDP tự động, không cài trust. Nếu Provider policy dùng OCSP/delta CRL hoặc format khác, verifier này phải báo thiếu/unsupported, dùng công cụ độc lập phù hợp; không bỏ check.

`node verify-material.mjs <result-material.json> <original-file>` verify raw signature (RSA PKCS1/PSS hoặc DER ECDSA theo đúng metadata) và signing-input digest/certificate. Output `RAW_SIGNATURE_PASS` vẫn để assembly/PKIX/source signed-attributes context coverage NOT_CHECKED; không gọi đó là PDF/CMS/XML PASS.

Bằng chứng chạy thật của helper: retained TEST PDF SHA256 `6c87f0995acac4365762444fec3593aeeb9c7ad093aacffcc3b037c7123ac9ba`, original `e8f0f1d427c7f6ef1c48a2f7dd6b94f9b207a7a00595e8bd2cd8a1242a567194`, TEST leaf `f4ac204fbc8689abdd29268880deb4cb434110df663d7075e948d3ce0403ba85` đã PASS independent PDF/CMS/profile/PKIX CRL. Đây là **đọc file lịch sử**, không giao dịch mới hoặc eIDCA UAT. Đưa nhầm `samples/sample.pdf` (SHA256 `68fcf14acc01f3eb8ac32c5317213ae24f261e61f7d5fa6bd62b91b35d00786f`) làm original đã bị từ chối đúng. Không trộn cặp input/output giữa các phiên.

Controlled CMS/XML vectors tạo khóa test trong memory, không ghi private key và không cấp authority runtime. Kết quả 6 PASS (valid/wrong input/revoked/tampered) nằm trong evidence, không phải Provider UAT. Signer ownership/key-use không được verifier tự suy ra.
