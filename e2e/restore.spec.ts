import { expect, test, type Page } from '@playwright/test';

// "Restore after moving": drags since the last construction can be put back in one tap.
test.skip(({ isMobile }) => !!isMobile, 'mouse drags; touch is covered in touch.spec');

async function setup(page: Page) {
  await page.goto('/?e2e');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
}
async function scr(page: Page, x: number, y: number) {
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
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await scr(page, ...from);
  const b = await scr(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}
const pointAt = (page: Page, name: string) =>
  page.evaluate((n) => {
    const s = (window as any).__drawgeo.useApp.getState();
    const id = s.doc.order.find((i: string) => s.doc.objects[i].name === n);
    const g = s.values.get(id);
    return [Math.round(g.x), Math.round(g.y)];
  }, name);
const restore = (page: Page) => page.getByTestId('restore-moved');

async function circleAB(page: Page) {
  await page.locator('.toolbar [data-tool="circle"]').click();
  const a = await scr(page, -60, 0);
  const b = await scr(page, 60, 0);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  await page.locator('.toolbar [data-tool="move"]').click();
}

test('appears only after a drag changes the figure, and puts points back to where they STARTED', async ({ page }) => {
  await setup(page);
  await circleAB(page);
  await expect(restore(page)).toHaveCount(0);
  const b = await scr(page, 60, 0);
  await page.mouse.click(b.x, b.y); // a tap on a point (select) is not a move
  await expect(restore(page)).toHaveCount(0);
  await drag(page, [60, 0], [100, 40]);
  await drag(page, [100, 40], [140, -30]); // same point again: the original must be kept
  await drag(page, [-60, 0], [-90, 20]);
  await expect(restore(page)).toBeVisible();
  const rb = (await restore(page).boundingBox())!;
  expect(rb.x).toBeGreaterThan(page.viewportSize()!.width * 0.75); // bottom-right on desktop too
  await restore(page).click();
  expect(await pointAt(page, 'A')).toEqual([-60, 0]);
  expect(await pointAt(page, 'B')).toEqual([60, 0]);
  await expect(restore(page)).toHaveCount(0);
  // restore is itself undoable: undo brings the moved figure (and the button) back
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await pointAt(page, 'B')).toEqual([140, -30]);
  await expect(restore(page)).toBeVisible();
});

test('undoing the drags hides it; constructing ends the session', async ({ page }) => {
  await setup(page);
  await circleAB(page);
  await drag(page, [60, 0], [100, 40]);
  await expect(restore(page)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(restore(page)).toHaveCount(0); // back where it started
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(restore(page)).toBeVisible();
  // construct something → the moved positions become the normal state
  await page.locator('.toolbar [data-tool="line"]').click();
  const a = await scr(page, -60, 0);
  const b = await scr(page, 100, 40);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  await expect(restore(page)).toHaveCount(0);
  await page.locator('.toolbar [data-tool="move"]').click();
  await drag(page, [100, 40], [60, 0]);
  await expect(restore(page)).toBeVisible(); // a new session starts from here
});

test('viewers of a shared link can drag points and put them back', async ({ page }) => {
  await setup(page);
  await circleAB(page);
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
  await drag(page, [60, 0], [120, 60]);
  expect(await pointAt(page, 'B')).toEqual([120, 60]);
  await restore(page).click();
  expect(await pointAt(page, 'B')).toEqual([60, 0]);
  // still read-only: tools stay disabled
  await expect(page.locator('.toolbar [data-tool="circle"]')).toBeDisabled();
});
