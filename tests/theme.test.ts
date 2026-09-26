import { describe, expect, it } from 'vitest';
import { contrast, DARK, LIGHT } from '../src/render/theme';

// PLAN.md §4.4: every object ≥ 3:1 against the canvas in both themes; text ≥ 4.5:1.
describe('theme contrast', () => {
  for (const t of [LIGHT, DARK]) {
    it(`${t.name}: objects are clearly visible`, () => {
      for (const c of [t.given, t.constructed, t.aux, t.accent, ...Object.values(t.colors)]) {
        expect(contrast(c, t.bg), `${c} on ${t.bg}`).toBeGreaterThanOrEqual(3);
      }
    });
    it(`${t.name}: labels, measures and UI text are readable`, () => {
      for (const c of [t.label, t.measure]) expect(contrast(c, t.bg), c).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.text, t.panel)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.textMuted, t.panel)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.buttonActiveText, t.buttonActive)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
