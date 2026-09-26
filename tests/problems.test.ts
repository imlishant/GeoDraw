import { describe, expect, it } from 'vitest';
import { PROBLEMS } from '../src/engine/problems';
import { checkSolution } from '../src/engine/checker';
import { Scratch } from '../src/engine/scratch';
import { newDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';

function setup(p: (typeof PROBLEMS)[number]) {
  const s = new Scratch(newDoc(p.title));
  const g = p.setup(s);
  s.doc.problemId = p.id;
  s.doc.problemGivens = g;
  return { s, g };
}

describe('problems', () => {
  for (const p of PROBLEMS) {
    describe(p.title, () => {
      it('an empty construction is not solved', () => {
        const { s } = setup(p);
        expect(checkSolution(s.doc, p.targets).solved).toBe(false);
      });

      it('the reference solution is solved, using only allowed tools', () => {
        const { s, g } = setup(p);
        p.solve(s, g);
        const r = checkSolution(s.doc, p.targets);
        expect(r.solved, `failed at trial ${r.failedTrial}`).toBe(true);
        for (const step of s.doc.steps) expect(p.tools).toContain(step.tool);
      });

      it('an eyeballed answer (free points placed on the target) is rejected', () => {
        const { s, g } = setup(p);
        p.solve(s, g);
        // Replace every constructed object by "fake" free points at their current spots:
        // lines through two free points, circles through free center/point.
        const vals = evaluateDoc(s.doc);
        const fake = setup(p);
        for (const id of s.doc.order) {
          const o = s.doc.objects[id];
          if (o.given) continue;
          const v = vals.get(id);
          if (!v) continue;
          if (v.k === 'point') fake.s.free(v.x, v.y);
          else if (v.k === 'line') {
            const a = fake.s.free(v.px, v.py);
            const b = fake.s.free(v.px + v.dx * 50, v.py + v.dy * 50);
            fake.s.line(a, b);
          } else if (v.k === 'circle') {
            const c = fake.s.free(v.cx, v.cy);
            const q = fake.s.free(v.cx + v.r, v.cy);
            fake.s.circle(c, q);
          }
        }
        expect(checkSolution(fake.s.doc, p.targets).solved).toBe(false);
      });
    });
  }
});
