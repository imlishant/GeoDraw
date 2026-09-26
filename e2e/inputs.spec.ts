import { expect, test, type Page } from '@playwright/test';

// Every way of giving a tool its inputs, through the real UI, checked against geometry.
test.skip(({ isMobile }) => !!isMobile, 'desktop mouse pass; touch has its own spec');

async function setup(page: Page) {
  await page.goto('/?e2e');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  await page.evaluate(() => (window as any).__drawgeo.useApp.setState({ toasts: [] }));
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
const click = async (page: Page, x: number, y: number, button: 'left' | 'right' = 'left') => {
  const p = await scr(page, x, y);
  await page.mouse.click(p.x, p.y, { button });
};
const tool = (page: Page, key: string) => page.locator(`.toolbar [data-tool="${key}"]`).click();
async function more(page: Page, key: string) {
  await page.locator('[data-tool="more"]').click();
  await page.getByRole('dialog', { name: 'More tools' }).locator(`[data-tool="${key}"]`).click();
}
/** Last step's created objects with their evaluated geometry and definitions. */
const last = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__drawgeo.useApp.getState();
    const st = s.doc.steps.at(-1);
    return {
      n: s.doc.steps.length,
      tool: st?.tool,
      out: (st?.outputs ?? []).filter((id: string) => !st.inputs.includes(id)).map((id: string) => ({ def: s.doc.objects[id].def, g: s.values.get(id) })),
      pending: s.session.picks.length,
    };
  });

test('Perpendicular: point first, then line; or line first, then an empty spot', async ({ page }) => {
  await setup(page);
  await tool(page, 'line');
  await click(page, -150, 0);
  await click(page, 150, 0); // horizontal line y = 0
  await tool(page, 'perpendicular');
  await click(page, 40, 80); // empty spot → new point
  await click(page, 100, 0); // the line
  let r = await last(page);
  expect(r.tool).toBe('perpendicular');
  expect(Math.abs(r.out[0].g.dx)).toBeLessThan(1e-9); // vertical
  expect(r.out[0].g.px).toBeCloseTo(40, 6);
  await click(page, -100, 0); // line first
  await click(page, -60, -90);
  r = await last(page);
  expect(r.out[0].g.px).toBeCloseTo(-60, 6);
});

test('Point tool: free, on a line (slides along it), and on a crossing', async ({ page }) => {
  await setup(page);
  await tool(page, 'line');
  await click(page, -150, 0);
  await click(page, 150, 0);
  await tool(page, 'line');
  await click(page, 0, -150);
  await click(page, 0, 150);
  await tool(page, 'point');
  await click(page, 60, 1.5); // near the horizontal line
  const onDef = await page.evaluate(() => {
    const s = (window as any).__drawgeo.useApp.getState();
    const id = s.doc.steps.at(-1).outputs[0];
    return { def: s.doc.objects[id].def, g: s.values.get(id) };
  });
  expect(onDef.def.t).toBe('on');
  expect(onDef.g.y).toBeCloseTo(0, 9); // snapped exactly onto the line
  await click(page, 1, 1); // the crossing of the two lines
  const intDef = await page.evaluate(() => {
    const s = (window as any).__drawgeo.useApp.getState();
    const id = s.doc.steps.at(-1).outputs[0];
    return s.doc.objects[id].def;
  });
  expect(intDef.t).toBe('int');
  await click(page, 80, 80);
  const freeDef = await page.evaluate(() => {
    const s = (window as any).__drawgeo.useApp.getState();
    return s.doc.objects[s.doc.steps.at(-1).outputs[0]].def.t;
  });
  expect(freeDef).toBe('free');
  // drag the on-line point: it stays on the line
  await tool(page, 'move');
  const from = await scr(page, 60, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y - 60, { steps: 6 });
  await page.mouse.up();
  const y = await page.evaluate(() => {
    const s = (window as any).__drawgeo.useApp.getState();
    const id = s.doc.order.find((i: string) => s.doc.objects[i].def.t === 'on');
    return s.values.get(id).y;
  });
  expect(y).toBeCloseTo(0, 9);
});

test('Compass with a circle as the radius; Midpoint of a segment and a circle center', async ({ page }) => {
  await setup(page);
  await tool(page, 'circle');
  await click(page, -100, 0);
  await click(page, -40, 0); // r = 60
  await tool(page, 'compass');
  await click(page, -100, 60); // on the circle → picks the circle
  await click(page, 120, 40); // center (new point)
  let r = await last(page);
  expect(r.out[0].g.r).toBeCloseTo(60, 6);
  expect(r.out[0].g.cx).toBeCloseTo(120, 6);
  await more(page, 'segment');
  await click(page, 0, -100);
  await click(page, 80, -60);
  await more(page, 'midpoint');
  await click(page, 40, -80); // on the segment
  r = await last(page);
  expect(r.out[0].g.x).toBeCloseTo(40, 6);
  expect(r.out[0].g.y).toBeCloseTo(-80, 6);
  await click(page, -100, -60); // on the first circle → its center
  r = await last(page);
  expect(r.out[0].g.x).toBeCloseTo(-100, 6);
});

test('Esc and right-click cancel a half-finished tool and discard its new points', async ({ page }) => {
  await setup(page);
  await tool(page, 'circle');
  await click(page, 0, 0);
  expect((await last(page)).pending).toBe(1);
  await page.keyboard.press('Escape');
  expect((await last(page)).pending).toBe(0);
  await click(page, 0, 0);
  await click(page, 50, 50, 'right');
  const s = await page.evaluate(() => {
    const st = (window as any).__drawgeo.useApp.getState();
    return { picks: st.session.picks.length, objects: st.doc.order.length };
  });
  expect(s).toEqual({ picks: 0, objects: 0 });
  await page.keyboard.press('Escape'); // second Esc: back to Move
  await expect(page.locator('.toolbar [data-tool="move"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Polygon closes by tapping the first vertex or pressing Enter', async ({ page }) => {
  await setup(page);
  await more(page, 'polygon');
  for (const [x, y] of [[0, 0], [100, 0], [50, 80], [0, 0]]) await click(page, x, y);
  expect((await last(page)).tool).toBe('polygon');
  await more(page, 'polygon');
  for (const [x, y] of [[-200, 0], [-120, 0], [-160, 90]]) await click(page, x, y);
  await page.keyboard.press('Enter');
  const r = await last(page);
  expect(r.n).toBe(2);
  expect(r.out.filter((o: any) => o.g?.k === 'region')).toHaveLength(1);
});

test('Picking the same point twice is refused for a line', async ({ page }) => {
  await setup(page);
  await tool(page, 'line');
  await click(page, 0, 0);
  await click(page, 0, 0);
  expect((await last(page)).n).toBe(0);
  expect((await last(page)).pending).toBe(1);
});
