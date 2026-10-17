# Tuân thủ Nghị định 30/2020/NĐ-CP — phạm vi và căn cứ

Tài liệu này mô tả những gì VNeCA Signature Designer kiểm tra về **hình thức hiển thị** chữ ký số theo Nghị định 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư, những gì là **diễn giải** của công cụ, và những gì **phải kiểm tra thủ công**.

> Kết quả “Tuân thủ” chỉ có nghĩa: mọi quy tắc áp dụng đã được đánh giá và đạt *về hình thức hiển thị*. Nó **không** xác nhận chữ ký số hợp lệ, chứng thư số còn hiệu lực, thẩm quyền người ký hay giá trị pháp lý của văn bản (Điều 5: giá trị pháp lý đến từ việc ký số bởi người có thẩm quyền và của cơ quan, tổ chức theo quy định).

## 1. Nguồn và cách xác minh

| Nguồn | Vai trò |
|---|---|
| Nghị định 30/2020/NĐ-CP, Phụ lục I “Thể thức, kỹ thuật trình bày văn bản hành chính và bản sao văn bản” | **Căn cứ chính.** Bản chính thức: Cơ sở dữ liệu quốc gia về VBPL (vbpl.vn, ItemID 141142) / Công báo |
| Bản tái hiện toàn văn Phụ lục I (thuvienphapluat.vn, vietjack.me) | Dùng để đối chiếu nguyên văn và số hiệu mục khi trang vbpl.vn không tải được nội dung tự động |
| https://lacviet.vn/huong-dan-ky-so-van-ban/ | Tài liệu giải thích thứ cấp — **không** dùng làm căn cứ |

Ngày đối chiếu: 17/10/2026. Tại thời điểm này không tìm thấy văn bản sửa đổi, bổ sung hay thay thế Nghị định 30/2020/NĐ-CP; các văn bản hành chính năm 2026 vẫn dẫn chiếu nghị định này. **Người dùng cần kiểm tra lại tình trạng hiệu lực trước khi áp dụng.** Trích dẫn nguyên văn nằm trong `src/engines/compliance-engine/legal-references.js` và hiển thị cạnh từng quy tắc trong ứng dụng.

### Các quy định được dùng (trích nguyên văn)

- **Phụ lục I, Phần I, Mục II, khoản 7, điểm d** — người có thẩm quyền: *“Hình ảnh, vị trí chữ ký số của người có thẩm quyền là hình ảnh chữ ký của người có thẩm quyền trên văn bản giấy, màu xanh, định dạng Portable Network Graphics (.png) nền trong suốt; đặt canh giữa chức vụ của người ký và họ tên người ký.”*
- **Phụ lục I, Phần I, Mục II, khoản 8, điểm a** — cơ quan, tổ chức: *“Hình ảnh, vị trí chữ ký số của cơ quan, tổ chức là hình ảnh dấu của cơ quan, tổ chức ban hành văn bản trên văn bản, màu đỏ, kích thước bằng kích thước thực tế của dấu, định dạng (.png) nền trong suốt, trùm lên khoảng 1/3 hình ảnh chữ ký số của người có thẩm quyền về bên trái.”*
- **Phụ lục I, Phần I, Mục II, khoản 8, điểm b** — văn bản kèm theo: cùng tệp → không ký số lên văn bản kèm theo; khác tệp → *“Vị trí: Góc trên, bên phải, trang đầu của văn bản kèm theo. Hình ảnh chữ ký số của cơ quan, tổ chức: Không hiển thị. Thông tin: Số và ký hiệu văn bản; thời gian ký (ngày tháng năm; giờ phút giây; múi giờ Việt Nam theo tiêu chuẩn ISO 8601) được trình bày bằng phông chữ Times New Roman, chữ in thường, kiểu chữ đứng, cỡ chữ 10, màu đen.”*
- **Phụ lục I, Phần II, Mục I, khoản 1** — hình thức sao: *“SAO Y” hoặc “SAO LỤC” hoặc “TRÍCH SAO”.*
- **Phụ lục I, Phần II, Mục I, khoản 3** — bản sao điện tử: *“Vị trí: Góc trên, bên phải, trang đầu của văn bản, trình bày tại ô số 14 Mục IV Phần I Phụ lục này. Hình ảnh chữ ký số của cơ quan, tổ chức: Không hiển thị. Thông tin: Hình thức sao, tên cơ quan, tổ chức sao văn bản, thời gian ký (…ISO 8601) được trình bày bằng phông chữ Times New Roman, chữ in thường, kiểu chữ đứng, cỡ chữ 10, màu đen.”*
- **Điều 13, khoản 7**: *“Vị trí, hình ảnh chữ ký số theo quy định tại Phụ lục I Nghị định này.”*
- **Phụ lục I, Phần I, Mục I, khoản 4** (phông chung): *“Phông chữ tiếng Việt Times New Roman, bộ mã ký tự Unicode theo Tiêu chuẩn Việt Nam TCVN 6909:2001, màu đen.”*

## 2. Các preset

| Preset | Hồ sơ | Hình thức | Vị trí mặc định khi thêm |
|---|---|---|---|
| **B** — Người có thẩm quyền | `nd30-authorized-person` | Chỉ một ảnh chữ ký (PNG, xanh, nền trong suốt). Đây là **vùng hiển thị**, không phải bản thân chữ ký số | Trên văn bản mẫu: canh giữa giữa “PHÓ GIÁM ĐỐC” và họ tên |
| **A** — Cơ quan, tổ chức | `nd30-organization` | Chỉ một ảnh dấu đỏ, kích thước thật (khai báo mm), PNG nền trong suốt. **Không** có preset chỉ-chữ nào được gắn nhãn tuân thủ | Trùm 1/3 ảnh chữ ký Preset B về bên trái |
| **A2** — Văn bản kèm theo (khác tệp) | `nd30-attachment` | Không ảnh; “Số: {{document.number}}” + “Thời gian ký: {{signing.datetime}}” ISO 8601; TNR 10 đen | Góc trên-phải trang 1, trong lề trên |
| **C** — Bản sao điện tử | `nd30-electronic-copy` | Không ảnh; hình thức sao, cơ quan sao, thời gian ký ISO 8601; TNR 10 đen | Góc trên-phải trang 1 (ô số 14), trong lề trên |

Preset A, B, C (và A2) là các hồ sơ quy tắc tách biệt; quy tắc của bản sao không áp dụng cho văn bản gốc và ngược lại. Ảnh dấu/chữ ký đi kèm là ảnh **MẪU** (in chữ “MẪU — KHÔNG CÓ GIÁ TRỊ”) để minh họa; chúng luôn làm quy tắc “ảnh thật” không đạt cho tới khi người dùng thay ảnh.

## 3. Bộ quy tắc

Mỗi quy tắc có: mã, căn cứ (văn bản + vị trí + trích dẫn), đối tượng áp dụng (loại văn bản, người ký), điều kiện kiểm tra (`evaluate`), mức độ (*Bắt buộc* = lỗi; *Cảnh báo*), giải thích. Loại kiểm tra:

- **auto** — xác định hoàn toàn từ dữ liệu mẫu/vị trí.
- **heuristic** — tự động nhưng văn bản luật mang tính định tính; **ngưỡng là diễn giải của công cụ** và được ghi rõ trong giải thích; thất bại chỉ là *Cảnh báo*.
- **manual** — phần mềm không kiểm chứng được; trạng thái “Cần xác nhận thủ công” cho tới khi người có trách nhiệm tích xác nhận (lưu kèm ghi chú và thời điểm trong mẫu).

| Mã | Preset | Quy tắc | Căn cứ | Mức | Loại |
|---|---|---|---|---|---|
| ND30-G-01 | mọi preset | Hình thức chữ ký được hiển thị | Điều 13 k7 | Bắt buộc | auto |
| ND30-G-02 | mọi preset | Nằm trong vùng hiển thị (CropBox) của trang | Điều 13 k7 | Bắt buộc | auto |
| ND30-B-01 | B | Có hình ảnh chữ ký | PL I, P.I, M.II, k7 đ.d | Bắt buộc | auto |
| ND30-B-02 | B | Định dạng PNG | 〃 | Bắt buộc | auto |
| ND30-B-03 | B | Nền trong suốt (có alpha, 4 góc trong suốt) | 〃 | Bắt buộc | auto |
| ND30-B-04 | B | Màu xanh (> 50 % điểm ảnh có mực thuộc dải sắc độ xanh lam) | 〃 | Bắt buộc | auto |
| ND30-B-05 | B | Canh giữa chức vụ và họ tên (lệch tâm ≤ 15 pt, nằm giữa hai dòng) | 〃 | Cảnh báo | heuristic |
| ND30-B-M1 | B | Ảnh là chữ ký thật trên văn bản giấy | 〃 | Bắt buộc | manual |
| ND30-B-X1 | B | Có thêm thông tin dạng chữ (không được quy định) | 〃 | Cảnh báo | manual |
| ND30-A-01 | A | Có hình ảnh dấu | PL I, P.I, M.II, k8 đ.a | Bắt buộc | auto |
| ND30-A-02 | A | Định dạng PNG | 〃 | Bắt buộc | auto |
| ND30-A-03 | A | Nền trong suốt | 〃 | Bắt buộc | auto |
| ND30-A-04 | A | Màu đỏ | 〃 | Bắt buộc | auto |
| ND30-A-05 | A | Kích thước bằng kích thước thật của dấu (±1 mm, đo phần có mực) | 〃 | Bắt buộc | auto |
| ND30-A-06 | A | Trùm khoảng 1/3 ảnh chữ ký người có thẩm quyền về bên trái (20–45 %) | 〃 | Cảnh báo | heuristic |
| ND30-A-M1 | A | Ảnh là dấu thật của cơ quan ban hành | 〃 | Bắt buộc | manual |
| ND30-A-X1 | A | Có thêm thông tin dạng chữ | 〃 | Cảnh báo | manual |
| ND30-K-P1 / C-P1 | A2 / C | Trang đầu | k8 đ.b / P.II M.I k3 | Bắt buộc | auto |
| ND30-K-P2 / C-P2 | A2 / C | Góc trên, bên phải (tâm ở nửa phải, mép trên trong 20 % chiều cao) | 〃 | Cảnh báo | heuristic |
| ND30-K-P3 / C-P3 | A2 / C | Không hiển thị hình ảnh | 〃 | Bắt buộc | auto |
| ND30-K-I1 | A2 | Có số và ký hiệu văn bản; thời gian ký | k8 đ.b | Bắt buộc | auto |
| ND30-C-I1 | C | Có hình thức sao, cơ quan sao, thời gian ký | P.II M.I k3 | Bắt buộc | auto |
| ND30-C-I2 | C | Hình thức sao ∈ {SAO Y, SAO LỤC, TRÍCH SAO} | P.II M.I k1 | Bắt buộc | auto |
| ND30-K/C-T1 | A2 / C | Times New Roman | k8 đ.b / P.II M.I k3 | Bắt buộc | auto |
| ND30-K/C-T2 | A2 / C | Chữ in thường | 〃 | Bắt buộc | auto |
| ND30-K/C-T3 | A2 / C | Kiểu chữ đứng | 〃 | Bắt buộc | auto |
| ND30-K/C-T4 | A2 / C | Cỡ chữ 10 | 〃 | Bắt buộc | auto |
| ND30-K/C-T5 | A2 / C | Màu đen | 〃 | Bắt buộc | auto |
| ND30-K/C-T6 | A2 / C | Không in đậm (không được quy định) | 〃 | Cảnh báo | heuristic |
| ND30-K/C-T7 | A2 / C | Thời gian ký ISO 8601, múi giờ Asia/Ho_Chi_Minh, hiển thị ngày và giờ | 〃 | Bắt buộc | auto |

Tổng cộng 46 lượt quy tắc (các quy tắc G-01/G-02 và nhóm định dạng chữ được áp cho từng preset).

## 4. Tổng hợp kết quả

| Kết quả | Điều kiện |
|---|---|
| **Tuân thủ** | Mọi quy tắc áp dụng = Đạt (quy tắc thủ công chỉ Đạt khi đã xác nhận) |
| **Không tuân thủ** | Có ít nhất một quy tắc *Bắt buộc* không đạt → hiển thị nhãn **Custom Mode** |
| **Cảnh báo** | Không có lỗi bắt buộc, nhưng còn quy tắc cảnh báo không đạt, chờ xác nhận thủ công hoặc chưa đánh giá (ví dụ chưa mở PDF nên chưa đánh giá được vị trí) |
| **Chưa đánh giá** | Mẫu không gắn hồ sơ NĐ 30 (Custom Mode) |

Người dùng vẫn được tùy biến tự do; mẫu không đạt hoặc không gắn hồ sơ luôn được ghi nhãn Custom Mode, không bao giờ hiển thị là tuân thủ.

## 5. Điểm chưa rõ / diễn giải của công cụ

Các điểm sau văn bản luật không định lượng hoặc có thể hiểu khác nhau. Công cụ **không tự đặt ra yêu cầu**; nó đánh dấu là heuristic/manual và ghi rõ ngưỡng:

1. **“Khoảng 1/3”** (Preset A): diễn giải 20–45 % chiều ngang ảnh chữ ký bị dấu che, tính từ mép trái, dấu phải lệch trái và chồng theo chiều dọc.
2. **“Góc trên, bên phải”** (A2, C): không có số đo; diễn giải tâm khung ở nửa phải và mép trên trong 20 % chiều cao trang. Vị trí chính xác của ô số 14 nằm trong sơ đồ Mục IV Phần I (hình vẽ), phần mềm không đo từ hình vẽ đó.
3. **“Canh giữa chức vụ và họ tên”** (B): dung sai 15 pt; cần PDF có lớp chữ và chuỗi chức vụ/họ tên khớp dữ liệu người ký; nếu không → kiểm tra thủ công.
4. **“Màu xanh”**: hiểu là xanh lam (mực bút xanh); phân loại theo sắc độ HSV 190°–265°. Tương tự **“màu đỏ”**: < 20° hoặc ≥ 330°.
5. **“Kích thước bằng kích thước thực tế của dấu”**: công cụ không biết kích thước dấu thật — người dùng khai báo (mm); đo phần có mực của ảnh khi hiển thị; dung sai ±1 mm là lựa chọn của công cụ.
6. **“Chữ in thường”** đối lập “chữ in hoa”; luật đồng thời quy định hình thức sao viết “SAO Y/SAO LỤC/TRÍCH SAO” và số ký hiệu văn bản có chữ hoa (“QĐ-…”). Công cụ chỉ kiểm tra phần chữ tĩnh và thuộc tính chuyển chữ hoa, không tính giá trị biến.
7. **Chữ đậm** không được nhắc tới → cảnh báo, không phải lỗi.
8. **Thông tin chữ bổ sung** trong Preset A/B (họ tên, thời gian…) không được quy định → cần xem xét thủ công, không mặc định là vi phạm.
9. **Cách trình bày ISO 8601**: dùng dạng mở rộng `YYYY-MM-DDThh:mm:ss+07:00`. Luật không quy định có nhãn (“Thời gian ký:”) hay không; preset có nhãn ngắn ở dạng chữ thường.
10. **Phông**: xem trước dùng Liberation Serif (tương thích số đo) thay cho Times New Roman; mẫu khai báo “Times New Roman” và dịch vụ ký phải dùng đúng phông này.
11. Định dạng ảnh **.png** áp dụng cho ảnh chữ ký và dấu; JPEG luôn bị từ chối vì không có nền trong suốt.

## 6. Ngoài phạm vi

Công cụ **không** kiểm tra: tính hợp lệ của chữ ký số/chứng thư số; thẩm quyền ký; trình tự ký (người có thẩm quyền ký trước, văn thư ký số cơ quan sau); thể thức các thành phần khác của văn bản (Quốc hiệu, số ký hiệu, nơi nhận…); yêu cầu số hóa bản sao (PDF ≥ 1.4, ≥ 200 dpi…); quy định về con dấu (Nghị định về quản lý và sử dụng con dấu). Các quy định đó cần được bảo đảm bởi quy trình nghiệp vụ và hệ thống ký số.
