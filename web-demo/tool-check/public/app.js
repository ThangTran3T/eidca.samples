const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const selection = document.querySelector('#selection');
const fileName = document.querySelector('#file-name');
const fileSize = document.querySelector('#file-size');
const fileSymbol = document.querySelector('#file-symbol');
const clearButton = document.querySelector('#clear-button');
const verifyButton = document.querySelector('#verify-button');
const buttonLabel = document.querySelector('#button-label');
const spinner = document.querySelector('#spinner');
const requestError = document.querySelector('#request-error');
const results = document.querySelector('#results');
const resultSummary = document.querySelector('#result-summary');
const statusIcon = document.querySelector('#status-icon');
const statusTitle = document.querySelector('#status-title');
const statusDescription = document.querySelector('#status-description');
const statusBadge = document.querySelector('#status-badge');
const metadataGrid = document.querySelector('#metadata-grid');
const signatureList = document.querySelector('#signature-list');
const rawJson = document.querySelector('#raw-json');

let selectedFile = null;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(value) {
  if (!value) return 'Không có';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

function textElement(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value ?? '—';
  return element;
}

function setFile(file) {
  if (!file) return;
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileSymbol.textContent = file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'XML';
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

function metadataItem(label, value, title) {
  const item = textElement('div', 'metadata-item', '');
  item.append(textElement('span', '', label));
  const strong = textElement('strong', '', value);
  if (title) strong.title = title;
  item.append(strong);
  return item;
}

function detailRow(label, value) {
  const row = textElement('div', 'detail-row', '');
  row.append(textElement('span', '', label), textElement('strong', '', value));
  return row;
}

function renderCertificate(certificate, label = 'Chứng thư người ký') {
  if (!certificate) return null;
  const box = textElement('div', 'certificate-box', '');
  box.append(textElement('h4', '', label));
  const grid = textElement('div', 'detail-grid', '');
  grid.append(
    detailRow('Chủ thể', certificate.common_name || certificate.subject_dn || 'Không xác định'),
    detailRow('Tổ chức', certificate.organization || 'Không có'),
    detailRow('Cấp bởi', certificate.issuer_common_name || certificate.issuer_dn || 'Không xác định'),
    detailRow('Số serial', certificate.serial_number || 'Không có'),
    detailRow('Có hiệu lực', formatDate(certificate.valid_from)),
    detailRow('Hết hiệu lực', formatDate(certificate.valid_to)),
    detailRow('Hiệu lực hiện tại', certificate.valid_at_check_time === false ? 'Không' : 'Có'),
    detailRow('Tin cậy chuỗi CA', certificate.trust_status === 'NOT_EVALUATED' ? 'Chưa đánh giá' : certificate.trust_status)
  );
  box.append(grid);
  return box;
}

function renderWarnings(warnings) {
  if (!warnings?.length) return null;
  const list = textElement('ul', 'warnings', '');
  warnings.forEach((warning) => list.append(textElement('li', '', warning)));
  return list;
}

function renderSignature(signature, format) {
  const card = textElement('article', 'signature-card', '');
  const heading = textElement('div', 'signature-heading', '');
  const copy = document.createElement('div');
  copy.append(
    textElement('h3', '', `Chữ ký #${signature.index}`),
    textElement('p', '', signature.message || (signature.valid ? 'Hợp lệ' : 'Không hợp lệ'))
  );
  heading.append(
    copy,
    textElement('span', `mini-badge ${signature.valid ? 'valid' : 'invalid'}`, signature.valid ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ')
  );
  card.append(heading);

  const details = textElement('div', 'detail-grid', '');
  if (format === 'XML') {
    details.append(
      detailRow('Thuật toán chữ ký', signature.signature_method || 'Không có'),
      detailRow('Canonicalization', signature.canonicalization_method || 'Không có'),
      detailRow('Thời gian ký', formatDate(signature.signing_time)),
      detailRow('Số tham chiếu', String(signature.references?.length || 0))
    );
  } else {
    const firstSigner = signature.cms?.signers?.[0];
    details.append(
      detailRow('SubFilter', signature.sub_filter || 'Không xác định'),
      detailRow('Phủ file hiện tại', signature.covers_current_file ? 'Có' : 'Không'),
      detailRow('Thuật toán băm', firstSigner?.digest_algorithm?.name || 'Không xác định'),
      detailRow('Thời gian ký', formatDate(firstSigner?.signing_time))
    );
  }
  card.append(details);

  if (format === 'XML') {
    signature.certificates?.forEach((certificate, index) => {
      const box = renderCertificate(certificate, `Chứng thư #${index + 1}`);
      if (box) card.append(box);
    });
  } else {
    signature.cms?.signers?.forEach((signer, index) => {
      const box = renderCertificate(signer.certificate, `Người ký CMS #${index + 1}`);
      if (box) card.append(box);
    });
  }

  const warnings = renderWarnings(signature.warnings);
  if (warnings) card.append(warnings);
  return card;
}

function renderResult(data) {
  const verification = data.verification;
  const isUnsigned = verification.status === 'UNSIGNED';
  const isWarning = verification.status === 'VALID_WITH_WARNINGS' || isUnsigned;
  const appearance = verification.valid ? (isWarning ? 'warning' : 'valid') : (isUnsigned ? 'warning' : 'invalid');

  resultSummary.className = `result-summary ${appearance}`;
  statusIcon.textContent = verification.valid ? '✓' : (isUnsigned ? '!' : '×');
  statusTitle.textContent = verification.valid
    ? 'Chữ ký hợp lệ'
    : (isUnsigned ? 'Không tìm thấy chữ ký' : 'Chữ ký không hợp lệ');
  statusDescription.textContent = verification.valid
    ? 'Nội dung được ký chưa bị thay đổi theo dữ liệu chữ ký.'
    : (isUnsigned
      ? 'Tài liệu không chứa chữ ký số được hỗ trợ.'
      : 'Không thể xác minh tính toàn vẹn của tài liệu.');
  statusBadge.textContent = verification.status.replaceAll('_', ' ');

  metadataGrid.replaceChildren(
    metadataItem('Tên file', data.file.name, data.file.name),
    metadataItem('Định dạng', data.file.type),
    metadataItem('Dung lượng', formatBytes(data.file.size)),
    metadataItem('Số chữ ký', String(verification.signature_count))
  );
  signatureList.replaceChildren(...verification.signatures.map((signature) => renderSignature(signature, verification.format)));
  if (!verification.signatures.length) {
    signatureList.append(textElement('p', '', verification.warnings?.[0] || 'Không có dữ liệu chữ ký.'));
  }
  rawJson.textContent = JSON.stringify(data, null, 2);
  results.classList.remove('hidden');
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function verifySelectedFile() {
  if (!selectedFile) return;
  verifyButton.disabled = true;
  buttonLabel.textContent = 'Đang kiểm tra…';
  spinner.classList.remove('hidden');
  requestError.classList.add('hidden');

  try {
    const form = new FormData();
    form.append('file', selectedFile);
    const response = await fetch('/api/verify', { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error?.message || `HTTP ${response.status}`);
    renderResult(data);
  } catch (error) {
    requestError.textContent = error instanceof Error ? error.message : String(error);
    requestError.classList.remove('hidden');
  } finally {
    verifyButton.disabled = false;
    buttonLabel.textContent = 'Kiểm tra chữ ký';
    spinner.classList.add('hidden');
  }
}

fileInput.addEventListener('change', () => setFile(fileInput.files?.[0]));
clearButton.addEventListener('click', clearFile);
verifyButton.addEventListener('click', verifySelectedFile);
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => setFile(event.dataTransfer?.files?.[0]));
