/**
 * Captures documentation screenshots from a running dev server.
 *   npm run dev            (in another terminal)
 *   node scripts/capture-screenshots.mjs
 * Output: docs/screenshots/*.png
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'screenshots');
const url = process.env.URL ?? 'http://localhost:5180/';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
const tid = (id) => page.getByTestId(id);
const open = async (file) => {
  await page.goto(url);
  await tid('app').waitFor();
  await tid(`sample-${file}`).click();
  await page.locator("[data-testid='page-1'] canvas").first().waitFor();
  await page.waitForTimeout(1200);
};

await page.goto(url);
await tid('app').waitFor();
await page.waitForTimeout(800);
await shot('01-empty-state');

await open('quyet-dinh-mau.pdf');
await tid('template-nd30-authorized-person').click();
await tid('template-nd30-organization').click();
await page.waitForTimeout(500);
await shot('02-decree30-presets-on-pdf');
await tid('tab-compliance').click();
await page.waitForTimeout(300);
await shot('03-compliance-panel');

await open('quyet-dinh-mau.pdf');
await tid('template-nd30-electronic-copy').click();
await tid('tab-compliance').click();
await page.waitForTimeout(300);
await shot('04-preset-c-compliant');

await open('quyet-dinh-mau.pdf');
await tid('template-hospital').click();
await tid('view-mode').locator('[role=radio]').nth(0).click();
await page.waitForTimeout(500);
await page.mouse.click(760, 470);
await page.waitForTimeout(300);
await shot('05-template-view-element-editing');
await tid('view-mode').locator('[role=radio]').nth(2).click();
await tid('rendered-page-1').waitFor();
await page.waitForTimeout(1500);
await shot('06-rendered-pdf-preview');

await open('quyet-dinh-mau.pdf');
await tid('template-enterprise').click();
await tid('export-json').click();
await page.waitForTimeout(500);
await shot('07-vneca-legacy-export');
await page.keyboard.press('Escape');

await open('kiem-thu-xoay-trang.pdf');
await tid('zoom-value').click();
await tid('zoom-50').click();
await page.evaluate(() => window.dispatchEvent(new CustomEvent('vneca:scroll-to-page', { detail: 2 })));
await page.waitForTimeout(900);
await tid('template-personal').click();
await tid('toggle-theme').click();
await page.waitForTimeout(900);
await shot('08-rotated-page-dark-theme');

await browser.close();
console.log(`✓ screenshots written to ${out}`);
