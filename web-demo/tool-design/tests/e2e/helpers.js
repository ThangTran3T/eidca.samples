import { expect } from '@playwright/test';

export const A4_HEIGHT = 841.89;

/** Serializable snapshot of editor state through the dev-only window hook. */
export function state(page) {
  return page.evaluate(() => {
    const s = window.__vnecaEditor.getState();
    return JSON.parse(
      JSON.stringify({
        signatures: s.signatures,
        selection: s.selection,
        zoom: s.zoom,
        viewRotation: s.viewRotation,
        view: s.view,
        displayMode: s.displayMode,
        docName: s.doc?.name ?? null,
        pages: s.doc?.pages ?? [],
        customTemplates: s.customTemplates,
        history: { past: s.history.past.length, future: s.history.future.length },
      })
    );
  });
}

export async function boot(page) {
  await page.goto('/');
  await expect(page.getByTestId('app')).toBeVisible();
}

export async function openSample(page, file) {
  await page.getByTestId(`sample-${file}`).click();
  await expect(page.getByTestId('page-1').locator('canvas').first()).toBeVisible();
  // wait until PDF.js painted something non-white
  await page.waitForFunction(() => {
    const c = document.querySelector("[data-testid='page-1'] canvas");
    return c && c.width > 10;
  });
}

/** Screen point of a PDF user-space point on an unrotated page. */
export async function screenPoint(page, pageNo, x, y) {
  const box = await page.getByTestId(`page-${pageNo}`).boundingBox();
  const { zoom } = await state(page);
  return { x: box.x + x * zoom, y: box.y + (A4_HEIGHT - y) * zoom };
}
