import { expect, test, type Page } from '@playwright/test';

// Real multi-touch through the Chrome DevTools Protocol: one-finger drag of a
// point, two-finger pinch zoom. Runs on the phone and tablet projects.

test.skip(({ isMobile }) => !isMobile, 'touch only');

async function setup(page: Page) {
  await page.goto('/?e2e');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
}

async function screen(page: Page, x: number, y: number) {
  return page.evaluate(
    ([x, y]) => {
      const h = (window as any).__drawgeo;
      const c = h.controller.cam;
      const vp = h.controller.renderer.vp;
      return { x: (x - c.cx) * c.zoom + vp.w / 2, y: -(y - c.cy) * c.zoom + vp.h / 2 };
    },
    [x, y],
  );
}

test('one finger drags a point; two fingers pinch-zoom', async ({ page }) => {
  await setup(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, pts: { x: number; y: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) } as any);

  await page.locator('.toolbar [data-tool="circle"]').click();
  for (const [x, y] of [[-50, 0], [50, 0]]) {
    const p = await screen(page, x, y);
    await page.touchscreen.tap(p.x, p.y);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc.steps.length)).toBe(1);

  // drag B with one finger (Move tool)
  await page.locator('.toolbar [data-tool="move"]').click();
  const b = await screen(page, 50, 0);
  await touch('touchStart', [b]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: b.x + i * 6, y: b.y }]);
  await touch('touchEnd', []);
  const r = await page.evaluate(() => {
    const s = (window as any).__drawgeo.useApp.getState();
    return [...s.values.values()].find((g: any) => g?.k === 'circle').r;
  });
  expect(r).toBeGreaterThan(110);
  // restore button: bottom-right on every device (opposite the book)
  const rb = page.getByTestId('restore-moved');
  await expect(rb).toBeVisible();
  const box = (await rb.boundingBox())!;
  expect(box.x).toBeGreaterThan(page.viewportSize()!.width * 0.75);
  await rb.tap();
  await expect(rb).toHaveCount(0);

  // pinch out with two fingers
  const z0 = await page.evaluate(() => (window as any).__drawgeo.controller.cam.zoom);
  const c = { x: 200, y: 300 };
  await touch('touchStart', [{ x: c.x - 40, y: c.y }, { x: c.x + 40, y: c.y }]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: c.x - 40 - i * 8, y: c.y }, { x: c.x + 40 + i * 8, y: c.y }]);
  await touch('touchEnd', []);
  const z1 = await page.evaluate(() => (window as any).__drawgeo.controller.cam.zoom);
  expect(z1).toBeGreaterThan(z0 * 1.8);
  await expect.poll(() => page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc.steps.length)).toBe(1); // gestures never construct
});

test('long-press pins a More tool without also selecting it; a short tap selects', async ({ page }) => {
  await setup(page);
  const cdp = await page.context().newCDPSession(page);
  await page.locator('[data-tool="more"]').tap();
  const item = page.getByRole('dialog', { name: 'More tools' }).locator('[data-tool="segment"]');
  const b = (await item.boundingBox())!;
  const at = [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 0 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at } as any);
  await page.waitForTimeout(750);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] } as any);
  await expect(page.locator('.toolbar [data-tool="segment"]')).toBeVisible(); // pinned
  await expect(page.getByRole('dialog', { name: 'More tools' })).toBeVisible(); // not chosen
  await expect(page.locator('.toolbar [data-tool="move"]')).toHaveAttribute('aria-pressed', 'true');
  await item.tap(); // a normal tap chooses it
  await expect(page.locator('.toolbar [data-tool="segment"]')).toHaveAttribute('aria-pressed', 'true');
});

test('small phone (iPhone 7 with Safari bars, 375×553): book and restore sit above the tools', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 600, 'phone layout');
  await page.setViewportSize({ width: 375, height: 553 });
  await setup(page);
  // make the restore button appear (a moved point)
  await page.evaluate(() => {
    const h = (window as any).__drawgeo;
    const s = h.useApp.getState();
    const o = { id: 'p1', kind: 'point', name: 'A', def: { t: 'free', x: 0, y: 0 } };
    h.useApp.setState({ doc: { ...s.doc, objects: { p1: o }, order: ['p1'] } });
    h.useApp.setState({ moveSession: { p1: { t: 'free', x: 10, y: 0 } } });
  });
  const tools = (await page.locator('.toolbar').boundingBox())!;
  for (const id of ['steps-button', 'restore-moved']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.y + box.height, `${id} overlaps the tools`).toBeLessThanOrEqual(tools.y);
    expect(box.y).toBeGreaterThan(0);
  }
});
