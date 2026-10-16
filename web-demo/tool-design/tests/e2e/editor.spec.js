import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { boot, openSample, state, screenPoint } from './helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sample = (f) => path.join(root, 'public', 'samples', f);

test.beforeEach(async ({ page }) => {
  await boot(page);
});

test.describe('PDF upload & rendering', () => {
  test('uploads a real PDF from disk and renders every page', async ({ page }) => {
    await page.getByTestId('empty-pdf-input').setInputFiles(sample('hop-dong-dien-tu.pdf'));
    await expect(page.getByTestId('doc-name')).toContainText('hop-dong-dien-tu.pdf · 3 trang');
    for (const n of [1, 2, 3]) await expect(page.getByTestId(`page-${n}`)).toBeVisible();
    await expect(page.getByTestId('toast-success')).toContainText('xử lý cục bộ');
  });

  test('rejects malformed and non-PDF files safely', async ({ page }) => {
    await page.getByTestId('empty-pdf-input').setInputFiles({ name: 'hong.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nthis is not a pdf body') });
    await expect(page.getByTestId('pdf-error')).toBeVisible();
    await page.getByTestId('empty-pdf-input').setInputFiles({ name: 'ghi-chu.txt', mimeType: 'text/plain', buffer: Buffer.from('xin chào') });
    await expect(page.getByTestId('pdf-error')).toContainText('Chỉ hỗ trợ tệp PDF');
    await page.getByTestId('empty-pdf-input').setInputFiles({ name: 'gia.pdf', mimeType: 'application/pdf', buffer: Buffer.from('GIF89a not a pdf') });
    await expect(page.getByTestId('pdf-error')).toContainText('%PDF-');
    expect((await state(page)).docName).toBe(null);
  });

  test('multipage navigation via thumbnails', async ({ page }) => {
    await openSample(page, 'hop-dong-dien-tu.pdf');
    await page.getByTestId('tab-pages').click();
    await expect(page.locator("[data-testid^='thumb-']")).toHaveCount(3);
    await page.getByTestId('thumb-3').click();
    await expect.poll(async () => page.evaluate(() => window.__vnecaEditor.getState().currentPage)).toBe(3);
  });

  test('bundled Vietnamese fonts are loaded for canvas rendering', async ({ page }) => {
    const ok = await page.evaluate(() => ['VNeCA Serif', 'VNeCA Sans'].every((f) => document.fonts.check(`12px "${f}"`, 'Nguyễn Thị Ánh Tuyết ỆỸỰ')));
    expect(ok).toBe(true);
  });
});

test.describe('placement, drag, resize, zoom', () => {
  test('drag and resize map to exact PDF coordinates; undo/redo restores them', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-enterprise').click();
    const s0 = (await state(page)).signatures[0];
    expect(s0.rect.width).toBe(190);
    const c = await screenPoint(page, 1, s0.rect.x + 95, s0.rect.y + 40);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 60, c.y + 40, { steps: 8 });
    await page.mouse.up();
    const s1 = (await state(page)).signatures[0];
    expect(s1.rect.x - s0.rect.x).toBeCloseTo(60, 0);
    expect(s1.rect.y - s0.rect.y).toBeCloseTo(-40, 0); // screen down = PDF y decreases

    const br = await screenPoint(page, 1, s1.rect.x + s1.rect.width, s1.rect.y);
    await page.mouse.move(br.x, br.y);
    await page.mouse.down();
    await page.mouse.move(br.x + 30, br.y + 20, { steps: 8 });
    await page.mouse.up();
    const s2 = (await state(page)).signatures[0];
    expect(s2.rect.width).toBeCloseTo(220, 0);
    expect(s2.rect.height).toBeCloseTo(100, 0);
    expect(s2.template.elements[0].text.fontSize).toBe(9); // fonts never scale on resize

    await page.getByTestId('undo').click();
    await page.getByTestId('undo').click();
    expect((await state(page)).signatures[0].rect).toEqual(s0.rect);
    await page.getByTestId('redo').click();
    expect((await state(page)).signatures[0].rect).toEqual(s1.rect);
  });

  test('PDF coordinates are independent of zoom', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-personal').click();
    const r = (await state(page)).signatures[0].rect;
    const sizes = [];
    for (const z of ['50', '100', '200', '400']) {
      await page.getByTestId('zoom-value').click();
      await page.getByTestId(`zoom-${z}`).click();
      await expect(page.getByTestId('zoom-value')).toHaveText(`${z}%`);
      expect((await state(page)).signatures[0].rect).toEqual(r);
      const pageBox = await page.getByTestId('page-1').boundingBox();
      sizes.push(pageBox.width);
    }
    expect(sizes[3] / sizes[0]).toBeCloseTo(8, 1);
  });

  test('rotated pages keep content upright and survive view rotation', async ({ page }) => {
    await openSample(page, 'kiem-thu-xoay-trang.pdf');
    const pages = (await state(page)).pages;
    expect(pages.map((p) => p.rotate)).toEqual([0, 90, 180, 270, 0]);
    await page.evaluate(() => window.__vnecaEditor.getState().setCurrentPage(2));
    await page.getByTestId('template-enterprise').click();
    const s = (await state(page)).signatures[0];
    expect(s.page).toBe(2);
    // design is 190×80 upright; on a /Rotate 90 page the PDF rect is 80×190
    expect(s.template.size).toEqual({ width: 190, height: 80 });
    expect(s.rect.width).toBeCloseTo(80, 5);
    expect(s.rect.height).toBeCloseTo(190, 5);
    await page.getByTestId('rotate-right').click();
    await page.getByTestId('rotate-right').click();
    expect((await state(page)).viewRotation).toBe(180);
    expect((await state(page)).signatures[0].rect).toEqual(s.rect);
    await page.getByTestId('reset-view').click();
    expect((await state(page)).viewRotation).toBe(0);
  });

  test('keyboard nudging and deletion', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-personal').click();
    const r = (await state(page)).signatures[0].rect;
    await page.evaluate(() => document.activeElement?.blur()); // shortcuts are ignored while typing in a field
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowUp');
    const r2 = (await state(page)).signatures[0].rect;
    expect(r2.x).toBeCloseTo(r.x + 1, 5);
    expect(r2.y).toBeCloseTo(r.y + 10, 5);
    await page.keyboard.press('Delete');
    expect((await state(page)).signatures).toHaveLength(0);
  });
});

test.describe('Decree 30 presets & compliance', () => {
  test('Preset C placed top-right of page 1 is compliant', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-nd30-electronic-copy').click();
    await page.getByTestId('tab-compliance').click();
    await expect(page.getByTestId('compliance-overall').locator('[data-overall]')).toHaveAttribute('data-overall', 'compliant');
    await expect(page.getByTestId('compliant-callout')).toBeVisible();
  });

  test('Preset B is centred automatically; the specimen image fails until replaced and attested', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-nd30-authorized-person').click();
    await page.getByTestId('tab-compliance').click();
    await expect(page.getByTestId('rule-ND30-B-05')).toHaveAttribute('data-status', 'pass');
    await expect(page.getByTestId('rule-ND30-B-M1')).toHaveAttribute('data-status', 'fail');
    await expect(page.getByTestId('compliance-overall').locator('[data-overall]')).toHaveAttribute('data-overall', 'non-compliant');
    await expect(page.getByTestId('compliance-overall')).toContainText('Custom Mode');
  });

  test('Preset A overlaps ~1/3 of the signer image on the left', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-nd30-authorized-person').click();
    await page.getByTestId('template-nd30-organization').click();
    await page.getByTestId('tab-compliance').click();
    await expect(page.getByTestId('rule-ND30-A-06')).toHaveAttribute('data-status', 'pass');
    await expect(page.getByTestId('rule-ND30-A-04')).toHaveAttribute('data-status', 'pass'); // red seal
  });

  test('breaking a typography rule flags non-compliance (Custom Mode)', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-nd30-electronic-copy').click();
    const id = (await state(page)).signatures[0].id;
    await page.evaluate((sid) => window.__vnecaEditor.getState().select(sid, 'copy-info'), id);
    await page.getByTestId('el-font-size').fill('12');
    await page.getByTestId('el-font-size').press('Enter');
    await page.getByTestId('tab-compliance').click();
    await expect(page.getByTestId('rule-ND30-C-T4')).toHaveAttribute('data-status', 'fail');
    await expect(page.getByTestId('compliance-overall')).toContainText('Custom Mode');
  });
});

test.describe('elements & properties', () => {
  test('adds elements, edits text with variables and conditional visibility', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-custom-blank').click();
    await page.getByTestId('tab-elements').click();
    await page.getByTestId('add-element-qr').click();
    await page.getByTestId('add-element-reason').click();
    let s = (await state(page)).signatures[0];
    expect(s.template.elements.map((e) => e.type)).toEqual(['text', 'text', 'qr', 'text']);
    expect(s.template.elements[3].text.content).toBe('Lý do: {{signing.reason}}');
    await page.getByTestId('el-content').fill('Nơi ký: {{signing.location}}');
    await page.getByTestId('insert-variable').click();
    await page.getByTestId('var-signing.datetime').click();
    await page.getByTestId('section-el-advanced').locator('button[aria-expanded]').first().click();
    await page.getByTestId('el-condition').click();
    s = (await state(page)).signatures[0];
    const el = s.template.elements[3];
    expect(el.text.content).toBe('Nơi ký: {{signing.location}} {{signing.datetime}}');
    expect(el.condition).toEqual({ variable: 'signing.reason', operator: 'notEmpty', value: '' });
    // layer ordering from the advanced section
    await page.getByTestId('back-to-signature').click();
    await expect(page.getByTestId('signature-properties')).toBeVisible();
  });

  test('display modes switch between placeholders, sample and runtime data', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-custom-blank').click();
    await page.getByTestId('display-mode').click();
    await page.getByTestId('mode-runtime').click();
    expect((await state(page)).displayMode).toBe('runtime');
    await page.getByTestId('display-mode').click();
    await page.getByTestId('runtime-data').click();
    await page.getByTestId('rt-signer-name').fill('Lê Thị Bích Ngọc');
    await page.getByTestId('runtime-apply').click();
    const name = await page.evaluate(() => window.__vnecaEditor.getState().runtimeData.signer.name);
    expect(name).toBe('Lê Thị Bích Ngọc');
  });
});

test.describe('import / export', () => {
  test('exports VNeCA sign_props JSON with warnings acknowledged', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-enterprise').click();
    await page.getByTestId('export-json').click();
    await expect(page.getByTestId('legacy-warnings')).toBeVisible();
    await expect(page.getByTestId('download-legacy')).toBeDisabled();
    await page.getByTestId('legacy-ack').check();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-legacy').click()]);
    expect(dl.suggestedFilename()).toMatch(/\.sign_props\.json$/);
    const json = JSON.parse(await readFile(await dl.path(), 'utf8'));
    const s = (await state(page)).signatures[0];
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ page: 1, lLx: Math.round(s.rect.x), lLy: Math.round(s.rect.y), width: 190, height: 80, template: 'text_only', text_color: '#ff0033', sign_visibility: 'shown' });
    expect(json[0].show_info).toEqual(['reason', 'location', 'name', 'org', 'date']);
  });

  test('Designer JSON round-trips through export and import', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-hospital').click();
    await page.getByTestId('template-doctor').click();
    const before = (await state(page)).signatures;
    await page.getByTestId('export-json').click();
    await page.getByTestId('tab-designer').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-designer').click()]);
    const text = await readFile(await dl.path(), 'utf8');
    expect(JSON.parse(text).format).toBe('vneca.signature-designer');
    await page.keyboard.press('Escape');
    await page.getByTestId('import-json').click();
    await page.getByRole('radio', { name: 'Thay thế tất cả' }).click();
    await page.getByTestId('import-file').setInputFiles({ name: 'thiet-ke.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await expect(page.getByTestId('import-report')).toContainText('Đã nhập 2 mục');
    const after = (await state(page)).signatures;
    expect(after.map((s) => ({ ...s, id: null }))).toEqual(before.map((s) => ({ ...s, id: null })));
  });

  test('imports the repository legacy sample (docs/sign_props_template.json)', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    const legacy = await readFile(path.join(root, '..', '..', 'docs', 'sign_props_template.json'), 'utf8');
    await page.getByTestId('import-json').click();
    await page.getByTestId('import-text').fill(legacy);
    await page.getByTestId('import-run').click();
    await expect(page.getByTestId('import-report')).toContainText('VNeCA sign_props');
    await expect(page.getByTestId('import-report')).toContainText('dựng lại gần đúng');
    const s = (await state(page)).signatures[0];
    expect(s.rect).toEqual({ x: 47, y: 693, width: 167, height: 95 });
  });

  test('saved templates persist across reloads', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-contract').click();
    await page.getByTestId('save-template').click();
    await page.getByTestId('save-template-name').fill('Mẫu hợp đồng của phòng pháp chế');
    await page.getByTestId('save-template-confirm').click();
    await page.reload();
    await expect(page.getByTestId('app')).toBeVisible();
    const custom = (await state(page)).customTemplates;
    expect(custom.map((t) => t.name)).toContain('Mẫu hợp đồng của phòng pháp chế');
    await expect(page.getByTestId('template-library')).toContainText('Mẫu hợp đồng của phòng pháp chế');
  });

  test('PNG and SVG export of the selected appearance', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-enterprise').click();
    const [svg] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-svg').click()]);
    const svgText = await readFile(await svg.path(), 'utf8');
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('Ký bởi: CÔNG TY CỔ PHẦN DƯỢC PHẨM'); // wrapped exactly like canvas/PDF
    expect(svgText).toContain('<tspan x="0" y="20.67">AN KHANG</tspan>');
    expect(svgText).toContain('Người ký: Lê Quang Huy');
    await page.getByTestId('export-png').click();
    const [png] = await Promise.all([page.waitForEvent('download'), page.getByTestId('png-300').click()]);
    const bytes = await readFile(await png.path());
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    // 190×80 pt at 300 DPI
    expect(bytes.readUInt32BE(16)).toBe(Math.ceil((190 * 300) / 72));
  });
});

test.describe('preview modes', () => {
  test('template preview works without a PDF', async ({ page }) => {
    await page.getByTestId('menu-new').click();
    await page.getByTestId('new-template').click();
    await expect(page.getByTestId('template-view')).toBeVisible();
    expect((await state(page)).signatures).toHaveLength(1);
  });

  test('rendered PDF preview shows the notice and downloads an unsigned PDF', async ({ page }) => {
    await openSample(page, 'quyet-dinh-mau.pdf');
    await page.getByTestId('template-nd30-electronic-copy').click();
    await page.getByTestId('preview-pdf').click();
    await expect(page.getByTestId('preview-notice')).toContainText('Đây là bản xem trước hình thức chữ ký, chưa phải tài liệu được ký số hợp lệ.');
    await expect(page.getByTestId('rendered-page-1')).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-preview').click()]);
    const pdf = (await readFile(await dl.path())).toString('latin1');
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf).not.toMatch(/\/ByteRange/);
    expect(pdf).not.toMatch(/\/Type\s*\/Sig\b/);
  });

  test('dark theme toggles', async ({ page }) => {
    await page.getByTestId('toggle-theme').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
