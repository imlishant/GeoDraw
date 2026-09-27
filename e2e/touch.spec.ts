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
  // restore button: bottom-right on phones (opposite the book), bottom-left next to it on tablets
  const rb = page.getByTestId('restore-moved');
  await expect(rb).toBeVisible();
  const box = (await rb.boundingBox())!;
  const vw = page.viewportSize()!.width;
  if (vw < 600) expect(box.x).toBeGreaterThan(vw / 2);
  else expect(box.x).toBeLessThan(vw / 4);
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
