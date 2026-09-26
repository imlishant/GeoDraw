import { expect, test } from '@playwright/test';

// A seeded "monkey": hundreds of random taps, drags, tool switches and shortcuts.
// Nothing may throw, the document must stay loadable, and it must survive a reload.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const seed of [1, 2, 3]) {
  test(`monkey run, seed ${seed}`, async ({ page, isMobile }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?e2e');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const rand = rng(seed);
    const box = (await page.getByTestId('canvas').boundingBox())!;
    const X = () => box.x + 40 + rand() * (box.width - 80);
    const Y = () => box.y + 110 + rand() * (box.height - 260);
    const mainTools = ['move', 'point', 'line', 'circle', 'perpBisector', 'perpendicular', 'angleBisector', 'parallel', 'compass', 'intersect'];
    const moreTools = ['segment', 'ray', 'midpoint', 'tangents', 'semicircle', 'sector', 'reflectLine', 'reflectPoint', 'translate', 'measureDistance', 'measureAngle', 'showHide', 'label'];
    const tap = (x: number, y: number) => (isMobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));

    for (let i = 0; i < 220; i++) {
      // close anything modal that a previous action opened
      await page.evaluate(() => (window as any).__drawgeo.useApp.setState({ dialog: null, prompt: null, confirm: null, menuOpen: false, popoverAt: null, toasts: [] }));
      const r = rand();
      if (r < 0.12) await page.locator(`.toolbar [data-tool="${mainTools[Math.floor(rand() * mainTools.length)]}"]`).click();
      else if (r < 0.18) {
        await page.locator('[data-tool="more"]').click();
        await page.getByRole('dialog', { name: 'More tools' }).locator(`[data-tool="${moreTools[Math.floor(rand() * moreTools.length)]}"]`).click();
      } else if (r < 0.75) await tap(X(), Y());
      else if (r < 0.85 && !isMobile) {
        const x = X();
        const y = Y();
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + (rand() - 0.5) * 200, y + (rand() - 0.5) * 200, { steps: 4 });
        await page.mouse.up();
      } else if (r < 0.9) await page.keyboard.press(isMobile ? 'Escape' : 'Control+z');
      else if (r < 0.93) await page.keyboard.press('Control+Shift+z');
      else if (r < 0.96) await page.keyboard.press('Escape');
      else await page.mouse.wheel(0, (rand() - 0.5) * 400);
    }

    expect(errors).toEqual([]);
    const before = await page.evaluate(() => {
      const s = (window as any).__drawgeo.useApp.getState();
      return { json: JSON.stringify(s.doc), steps: s.doc.steps.length, objects: s.doc.order.length };
    });
    expect(before.steps).toBeGreaterThan(5); // the monkey actually built things
    // autosave → reload restores the same construction
    await page.waitForTimeout(800);
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => (window as any).__drawgeo.useApp.getState().doc.order.length))
      .toBe(before.objects);
    expect(errors).toEqual([]);
  });
}
