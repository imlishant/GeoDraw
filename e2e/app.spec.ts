import { expect, test, type Page } from '@playwright/test';

type Hook = {
  useApp: { getState(): any; setState(s: any): void };
  controller: { cam: { cx: number; cy: number; zoom: number }; renderer: { vp: { w: number; h: number } } };
};

async function fresh(page: Page, query = '?e2e') {
  await page.goto('/' + query);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((r) => {
      const req = indexedDB.deleteDatabase('drawgeo');
      req.onsuccess = req.onerror = req.onblocked = () => r();
    });
  });
  await page.goto('/' + query);
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  await page.evaluate(() => (window as any).__drawgeo.useApp.setState({ toasts: [] }));
}

/** World → page coordinates, using the live camera. */
async function screen(page: Page, x: number, y: number) {
  return page.evaluate(
    ([x, y]) => {
      const h = (window as any).__drawgeo as Hook;
      const c = h.controller.cam;
      const vp = h.controller.renderer.vp;
      return { x: (x - c.cx) * c.zoom + vp.w / 2, y: -(y - c.cy) * c.zoom + vp.h / 2 };
    },
    [x, y],
  );
}

async function tap(page: Page, x: number, y: number) {
  const p = await screen(page, x, y);
  if (page.viewportSize()!.width < 600 || (await page.evaluate(() => matchMedia('(pointer: coarse)').matches))) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

async function tool(page: Page, key: string) {
  await page.locator(`.toolbar [data-tool="${key}"]`).click();
}

/** Number of recorded construction steps. */
const stepCount = (page: Page) => page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc.steps.length);
const expectSteps = (page: Page, n: number) => expect.poll(() => stepCount(page)).toBe(n);

test('Euclidea-style layout: 10 tools + More, undo/redo, no score', async ({ page }) => {
  await fresh(page);
  await expect(page.locator('.toolbar .tool-btn')).toHaveCount(11);
  await expect(page.getByTestId('score')).toHaveCount(0);
  await expectSteps(page, 0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await page.screenshot({ path: `test-results/layout-${test.info().project.name}.png` });
});

test('construct an equilateral triangle, see steps, undo/redo', async ({ page }) => {
  await fresh(page);
  await tool(page, 'circle');
  await tap(page, -60, 0);
  await tap(page, 60, 0);
  await expectSteps(page, 1);
  await tap(page, 60, 0); // existing point B
  await tap(page, -60, 0); // existing point A
  await expectSteps(page, 2);
  // Intersect: tap directly on the upper crossing (a "virtual intersection")
  await tool(page, 'intersect');
  await tap(page, 0, 60 * Math.sqrt(3));
  await tool(page, 'line');
  await tap(page, -60, 0);
  await tap(page, 0, 60 * Math.sqrt(3));
  await tool(page, 'line');
  await tap(page, 60, 0);
  await tap(page, 0, 60 * Math.sqrt(3));
  await expectSteps(page, 5);
  const st = await page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc);
  expect(st.steps.map((s: any) => s.tool)).toEqual(['circle', 'circle', 'intersect', 'line', 'line']);
  expect(Object.keys(st.objects)).toHaveLength(7); // A, B, 2 circles, C, 2 lines
  await page.getByTestId('steps-button').click();
  await expect(page.getByTestId('steps-list').locator('.row')).toHaveCount(5);
  await page.screenshot({ path: `test-results/triangle-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Undo' }).click();
  await expectSteps(page, 4);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expectSteps(page, 5);
});

test('dragging a free point moves everything built on it', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'mouse drag');
  await fresh(page);
  await tool(page, 'circle');
  await tap(page, -60, 0);
  await tap(page, 60, 0);
  await tool(page, 'move');
  const from = await screen(page, 60, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y, { steps: 5 });
  await page.mouse.move(from.x + 60, from.y, { steps: 5 });
  await page.mouse.up();
  const r = await page.evaluate(() => {
    const s = (window as any).__drawgeo.useApp.getState();
    const c = [...s.values.values()].find((g: any) => g && g.k === 'circle');
    return c.r;
  });
  expect(r).toBeGreaterThan(120);
  await expectSteps(page, 1); // moving is not a step
});

test('More drawer: search, pick a tool, measure live', async ({ page }) => {
  await fresh(page);
  await page.locator('[data-tool="more"]').click();
  await expect(page.getByRole('dialog', { name: 'More tools' })).toBeVisible();
  await page.screenshot({ path: `test-results/more-${test.info().project.name}.png` });
  await page.getByRole('dialog', { name: 'More tools' }).locator('[data-tool="segment"]').click();
  await tap(page, -50, -20);
  await tap(page, 50, -20);
  await expectSteps(page, 1);
  await expect(page.locator('.toolbar [data-tool="segment"]')).toBeVisible(); // last-used slot
  await page.locator('[data-tool="more"]').click();
  await page.getByRole('dialog', { name: 'More tools' }).locator('[data-tool="measureDistance"]').click();
  await tap(page, -50, -20);
  await tap(page, 50, -20);
  const m = await page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc.measures.length);
  expect(m).toBe(1);
});

test('typed-number tool: circle with a given radius', async ({ page }) => {
  await fresh(page);
  await page.locator('[data-tool="more"]').click();
  await page.getByRole('dialog', { name: 'More tools' }).locator('[data-tool="circleRadius"]').click();
  await tap(page, 0, 0);
  await page.getByRole('dialog', { name: 'Radius' }).getByRole('textbox').fill('1.5');
  await page.getByRole('button', { name: 'OK' }).click();
  await expectSteps(page, 1);
  const r = await page.evaluate(() => [...(window as any).__drawgeo.useApp.getState().values.values()].find((g: any) => g?.k === 'circle').r);
  expect(r).toBeCloseTo(150, 6); // 1.5 units × 100
});

test('dark mode keeps everything visible', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => localStorage.setItem('drawgeo.settings', JSON.stringify({ theme: 'dark' })));
  await page.reload();
  await tool(page, 'circle');
  await tap(page, -60, 0);
  await tap(page, 60, 0);
  await tool(page, 'perpBisector');
  await tap(page, -60, 0);
  await tap(page, 60, 0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: `test-results/dark-${test.info().project.name}.png` });
});

test('share link opens read-only with replay', async ({ page }) => {
  await fresh(page);
  await tool(page, 'circle');
  await tap(page, -60, 0);
  await tap(page, 60, 0);
  await page.evaluate(() => {
    (navigator as any).clipboard.writeText = async (t: string) => ((window as any).__copied = t);
    (navigator as any).share = undefined;
  });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Share link…' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__copied)).toContain('#share=');
  const link: string = await page.evaluate(() => (window as any).__copied);
  await page.goto(link.replace('/#share=', '/?e2e#share='));
  await expect(page.getByText('Shared construction.')).toBeVisible();
  await expectSteps(page, 1);
  await expect(page.locator('.toolbar [data-tool="circle"]')).toBeDisabled();
});

test('theme switch in the top bar flips light ↔ dark and is remembered', async ({ page }) => {
  await fresh(page);
  const before = await page.locator('html').getAttribute('data-theme');
  await page.getByTestId('theme-toggle').click();
  const after = before === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', after);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', after);
});

test('More drawer closes without choosing a tool: ✕, tapping outside (nothing gets drawn), Esc', async ({ page, isMobile }) => {
  await fresh(page);
  await tool(page, 'circle');
  const more = page.getByRole('dialog', { name: 'More tools' });
  await page.locator('[data-tool="more"]').click();
  await more.getByRole('button', { name: 'Close' }).click();
  await expect(more).toHaveCount(0);
  await page.locator('[data-tool="more"]').click();
  const p = await screen(page, 0, 150);
  if (isMobile) await page.touchscreen.tap(p.x, 40);
  else await page.mouse.click(p.x, 40);
  await expect(more).toHaveCount(0);
  await expectSteps(page, 0); // the outside tap did not act as a Circle click
  expect(await page.evaluate(() => (window as any).__drawgeo.useApp.getState().session.picks.length)).toBe(0);
  if (!isMobile) {
    await page.locator('[data-tool="more"]').click();
    await page.keyboard.press('Escape');
    await expect(more).toHaveCount(0);
  }
  await expect(page.locator('.toolbar [data-tool="circle"]')).toHaveAttribute('aria-pressed', 'true'); // tool unchanged
});

test('right-click pins/unpins a More tool without selecting it', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'touch uses long-press (touch.spec)');
  await fresh(page);
  await page.locator('[data-tool="more"]').click();
  const more = page.getByRole('dialog', { name: 'More tools' });
  await expect(more.locator('.pinned')).toHaveCount(0); // no pin marks until something is pinned
  await more.locator('[data-tool="tangents"]').click({ button: 'right' });
  await expect(more).toBeVisible(); // pinning is not choosing
  await expect(page.locator('.toolbar [data-tool="tangents"]')).toBeVisible();
  await expect(more.locator('[data-tool="tangents"] .pinned')).toHaveCount(1);
  await expect(page.locator('.toolbar [data-tool="move"]')).toHaveAttribute('aria-pressed', 'true');
  await more.locator('[data-tool="tangents"]').click({ button: 'right' });
  await expect(page.locator('.toolbar [data-tool="tangents"]')).toHaveCount(0);
});
