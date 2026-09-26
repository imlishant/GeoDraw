import type { Measure, Values } from './types';

export interface MeasureValue {
  value: number | null;
  unit: '' | '°' | ' u²';
}

export function measureValue(m: Measure, vals: Values): MeasureValue {
  switch (m.t) {
    case 'distance': {
      const a = vals.get(m.a);
      const b = vals.get(m.b);
      if (!a || !b || a.k !== 'point' || b.k !== 'point') return { value: null, unit: '' };
      return { value: Math.hypot(a.x - b.x, a.y - b.y) / UNIT, unit: '' };
    }
    case 'angle': {
      const a = vals.get(m.a);
      const v = vals.get(m.v);
      const b = vals.get(m.b);
      if (!a || !v || !b || a.k !== 'point' || v.k !== 'point' || b.k !== 'point') return { value: null, unit: '°' };
      const a1 = Math.atan2(a.y - v.y, a.x - v.x);
      const a2 = Math.atan2(b.y - v.y, b.x - v.x);
      let d = Math.abs(a2 - a1);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return { value: (d * 180) / Math.PI, unit: '°' };
    }
    case 'area': {
      const g = vals.get(m.of);
      if (!g) return { value: null, unit: ' u²' };
      if (g.k === 'region') {
        let s = 0;
        for (let i = 0; i < g.pts.length; i++) {
          const p = g.pts[i];
          const q = g.pts[(i + 1) % g.pts.length];
          s += p.x * q.y - q.x * p.y;
        }
        return { value: Math.abs(s) / 2 / (UNIT * UNIT), unit: ' u²' };
      }
      if (g.k === 'circle') {
        const sweep = g.a0 !== undefined && g.a1 !== undefined ? g.a1 - g.a0 : 2 * Math.PI;
        return { value: (0.5 * sweep * g.r * g.r) / (UNIT * UNIT), unit: ' u²' };
      }
      return { value: null, unit: ' u²' };
    }
  }
}

/** World units per displayed length unit (so a typical figure reads as ~1–10, not ~100–500). */
export const UNIT = 100;
