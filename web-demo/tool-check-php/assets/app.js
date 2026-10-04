const $ = (selector) => document.querySelector(selector);
const fileInput = $('#file-input');
const dropZone = $('#drop-zone');
const selection = $('#selection');
const verifyButton = $('#verify-button');
const requestError = $('#request-error');
const results = $('#results');
let selectedFile = null;

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function bytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(2)} MB`;
}

function date(value) {
  if (!value) return 'Không có';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
}

function chooseFile(file) {
  if (!file) return;
  selectedFile = file;
  $('#file-name').textContent = file.name;
  $('#file-size').textContent = bytes(file.size);
  $('#file-type').textContent = file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'XML';
  dropZone.classList.add('hidden');
  selection.classList.remove('hidden');
  verifyButton.disabled = false;
  requestError.classList.add('hidden');
  results.classList.add('hidden');
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  dropZone.classList.remove('hidden');
  selection.classList.add('hidden');
  verifyButton.disabled = true;
  results.classList.add('hidden');
  requestError.classList.add('hidden');
}

function detail(label, value) {
  const box = element('div', 'detail');
  box.append(element('span', '', label), element('strong', '', value ?? '—'));
  return box;
}

function certificateCard(certificate, title) {
  if (!certificate) return null;
  const card = element('div', 'certificate');
  card.append(element('h4', '', title));
  const grid = element('div', 'detail-grid');
  grid.append(
    detail('Chủ thể', certificate.common_name || certificate.subject_dn || 'Không xác định'),
    detail('Tổ chức', certificate.organization || 'Không có'),
    detail('Cấp bởi', certificate.issuer_common_name || certificate.issuer_dn || 'Không xác định'),
    detail('Số serial', certificate.serial_number || 'Không có'),
    detail('Có hiệu lực', date(certificate.valid_from)),
    detail('Hết hiệu lực', date(certificate.valid_to)),
    detail('Hiệu lực hiện tại', certificate.valid_at_check_time === false ? 'Không' : 'Có'),
    detail('Tin cậy chuỗi CA', certificate.trust_status === 'NOT_EVALUATED' ? 'Chưa đánh giá' : certificate.trust_status)
  );
  card.append(grid);
  return card;
}

function warnings(items) {
  if (!items?.length) return null;
  const list = element('ul', 'warnings');
  items.forEach((item) => list.append(element('li', '', item)));
  return list;
}

function signatureCard(signature, format) {
  const card = element('article', 'signature');
  const heading = element('header', 'signature-heading');
  const copy = element('div');
  copy.append(element('h3', '', `Chữ ký #${signature.index}`), element('p', '', signature.message || 'Không có mô tả'));
  heading.append(copy, element('span', `mini-badge ${signature.valid ? 'valid' : 'invalid'}`, signature.valid ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'));
  card.append(heading);

  const grid = element('div', 'detail-grid');
  if (format === 'XML') {
    grid.append(
      detail('Thuật toán chữ ký', signature.signature_method),
      detail('Canonicalization', signature.canonicalization_method),
      detail('Thời gian ký', date(signature.signing_time)),
      detail('Số tham chiếu', String(signature.references?.length || 0))
    );
    signature.certificates?.forEach((certificate, index) => {
      const node = certificateCard(certificate, `Chứng thư #${index + 1}`);
      if (node) card.append(node);
    });
  } else {
    const signer = signature.cms?.signers?.[0];
    grid.append(
      detail('SubFilter', signature.sub_filter),
      detail('Phủ file hiện tại', signature.covers_current_file ? 'Có' : 'Không'),
      detail('Thuật toán băm', signer?.digest_algorithm?.name),
      detail('Thời gian ký', date(signer?.signing_time))
    );
    signature.cms?.signers?.forEach((item, index) => {
      const node = certificateCard(item.certificate, `Người ký CMS #${index + 1}`);
      if (node) card.append(node);
    });
  }
  card.insertBefore(grid, card.children[1] || null);
  const list = warnings(signature.warnings);
  if (list) card.append(list);
  return card;
}

function render(data) {
  const verification = data.verification;
  const unsigned = verification.status === 'UNSIGNED';
  const appearance = verification.valid ? 'valid' : (unsigned ? 'warning' : 'invalid');
  $('#summary').className = `summary ${appearance}`;
  $('#status-icon').textContent = verification.valid ? '✓' : (unsigned ? '!' : '×');
  $('#status-title').textContent = verification.valid ? 'Chữ ký hợp lệ' : (unsigned ? 'Không tìm thấy chữ ký' : 'Chữ ký không hợp lệ');
  $('#status-copy').textContent = verification.valid
    ? 'Nội dung được ký chưa bị thay đổi theo dữ liệu chữ ký.'
    : (unsigned ? 'Tài liệu không chứa chữ ký số được hỗ trợ.' : 'Không thể xác minh tính toàn vẹn của tài liệu.');
  $('#status-badge').textContent = verification.status.replaceAll('_', ' ');

  $('#metadata').replaceChildren(
    detail('Tên file', data.file.name), detail('Định dạng', data.file.type),
    detail('Dung lượng', bytes(data.file.size)), detail('Số chữ ký', String(verification.signature_count))
  );
  const cards = verification.signatures.map((signature) => signatureCard(signature, verification.format));
  $('#signature-list').replaceChildren(...cards);
  if (!cards.length) $('#signature-list').append(element('p', 'empty', verification.warnings?.[0] || 'Không có dữ liệu chữ ký.'));
  $('#raw-json').textContent = JSON.stringify(data, null, 2);
  results.classList.remove('hidden');
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function verify() {
  if (!selectedFile) return;
  verifyButton.disabled = true;
  $('#button-label').textContent = 'Đang kiểm tra…';
  $('#spinner').classList.remove('hidden');
  requestError.classList.add('hidden');
  try {
    const form = new FormData();
    form.append('file', selectedFile);
    const response = await fetch('api/verify.php', { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error?.message || `HTTP ${response.status}`);
    render(data);
  } catch (error) {
    requestError.textContent = error instanceof Error ? error.message : String(error);
    requestError.classList.remove('hidden');
  } finally {
    verifyButton.disabled = false;
    $('#button-label').textContent = 'Kiểm tra chữ ký';
    $('#spinner').classList.add('hidden');
  }
}

fileInput.addEventListener('change', () => chooseFile(fileInput.files?.[0]));
$('#clear-button').addEventListener('click', clearFile);
verifyButton.addEventListener('click', verify);
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
});
['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault(); dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault(); dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => chooseFile(event.dataTransfer?.files?.[0]));
