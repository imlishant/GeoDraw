import { expect, test, type Page } from '@playwright/test';

// Drive most tools through the real UI and fail on any runtime error.
test.skip(({ isMobile }) => !!isMobile, 'desktop pass is enough for the smoke run');

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
const click = async (page: Page, x: number, y: number) => {
  const p = await screen(page, x, y);
  await page.mouse.click(p.x, p.y);
};
const steps = (page: Page) => page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc.steps.length);
async function more(page: Page, key: string) {
  await page.locator('[data-tool="more"]').click();
  await page.getByRole('dialog', { name: 'More tools' }).locator(`[data-tool="${key}"]`).click();
}

test('every kind of tool works without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?e2e');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // setup: points A(-100,0) B(100,0), segment AB, circle c around O(0,-120)
  await more(page, 'segment');
  await click(page, -100, 0);
  await click(page, 100, 0);
  await page.locator('.toolbar [data-tool="circle"]').click();
  await click(page, 0, -120);
  await click(page, 50, -120);
  let n = await steps(page);
  expect(n).toBe(2);

  const expectStep = async (label: string) => {
    await expect.poll(() => steps(page), { message: label }).toBe(n + 1);
    n++;
  };

  await page.locator('.toolbar [data-tool="perpBisector"]').click();
  await click(page, -100, 0);
  await click(page, 100, 0);
  await expectStep('perp bisector');

  await page.locator('.toolbar [data-tool="perpendicular"]').click();
  await click(page, -60, 0); // the segment (line pick)
  await click(page, -60, 80); // new free point
  await expectStep('perpendicular');

  await page.locator('.toolbar [data-tool="parallel"]').click();
  await click(page, 30, 0);
  await click(page, 30, 150);
  await expectStep('parallel');

  await page.locator('.toolbar [data-tool="angleBisector"]').click();
  await click(page, 100, 0);
  await click(page, -100, 0);
  await click(page, -60, 80);
  await expectStep('angle bisector');

  await page.locator('.toolbar [data-tool="compass"]').click();
  await click(page, -100, 0);
  await click(page, 100, 0);
  await click(page, 0, -120);
  await expectStep('compass');

  await more(page, 'tangents');
  await click(page, 230, -60);
  await click(page, 0, -170); // on circle c (radius 50)
  await expectStep('tangents');

  await more(page, 'midpoint');
  await click(page, -100, 0);
  await click(page, 100, 0);
  await expectStep('midpoint');

  await more(page, 'polygon');
  for (const [x, y] of [[150, 100], [250, 100], [220, 180], [150, 100]]) await click(page, x, y);
  await expectStep('polygon');

  await more(page, 'reflectLine');
  await click(page, 150, 100);
  await click(page, 0, 40); // perpendicular bisector (x = 0)
  await expectStep('reflect');

  await more(page, 'sector');
  await click(page, -250, -200);
  await click(page, -180, -200);
  await click(page, -250, -130);
  await expectStep('sector');

  await more(page, 'rotate');
  await click(page, 150, 100);
  await click(page, 250, 100);
  await click(page, 220, 180);
  await click(page, 150, 100);
  await click(page, 250, 100);
  await expectStep('rotate');

  await more(page, 'regularPolygon');
  await click(page, -250, 150);
  await click(page, -200, 150);
  await page.getByRole('button', { name: 'OK' }).click();
  await expectStep('regular polygon');

  await more(page, 'measureAngle');
  await click(page, 100, 0);
  await click(page, -100, 0);
  await click(page, -60, 80);
  await more(page, 'measureArea');
  await click(page, 200, 120);
  const measures = await page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc.measures.length);
  expect(measures).toBe(2);

  // delete a point that others depend on → cascade confirmation
  await more(page, 'delete');
  await click(page, -100, 0);
  await expect(page.getByRole('dialog', { name: 'Are you sure?' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Are you sure?' }).getByRole('button', { name: 'Delete' }).click();
  expect(await steps(page)).toBeLessThan(n);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => steps(page)).toBe(n);

  await page.screenshot({ path: 'test-results/all-tools.png' });
  expect(errors).toEqual([]);
});
