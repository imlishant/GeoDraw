import { expect, test } from '@playwright/test';

// Guards against "the model changes but nothing is drawn": after drawing a circle,
// the canvas must actually contain dark stroke pixels along it.
test('what you construct is actually drawn on the canvas', async ({ page }) => {
  await page.goto('/?e2e');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.toolbar [data-tool="circle"]').click();
  const box = (await page.getByTestId('canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const tap = (x: number, y: number) => (test.info().project.name === 'desktop' || test.info().project.name === 'dev-server' ? page.mouse.click(x, y) : page.touchscreen.tap(x, y));
  await tap(cx - 60, cy);
  await tap(cx + 60, cy);
  await expect.poll(() => page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc.steps.length)).toBe(1);
  // the circle is centred at (cx-60, cy) with radius 120: sample its leftmost point
  const drawn = await page.evaluate(
    async ([x, y]) => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const c = document.querySelector('[data-testid="canvas"] canvas') as HTMLCanvasElement;
      const dpr = c.width / c.getBoundingClientRect().width;
      const r = c.getBoundingClientRect();
      const ctx = c.getContext('2d')!;
      const px = (sx: number, sy: number) => ctx.getImageData(Math.round((sx - r.left) * dpr), Math.round((sy - r.top) * dpr), 1, 1).data;
      // an undrawn canvas is transparent black, so require an opaque background first
      const bg = px(x + 60, y);
      if (bg[3] !== 255) return -1;
      let dark = 0;
      for (let dx = -3; dx <= 3; dx++) {
        const d = px(x + dx, y);
        if (d[3] === 255 && d[0] + d[1] + d[2] < 450) dark++;
      }
      return dark;
    },
    [cx - 180, cy],
  );
  expect(drawn).toBeGreaterThan(0);
});
