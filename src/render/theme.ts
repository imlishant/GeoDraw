// One set of semantic tokens for the canvas AND the UI (PLAN.md §4.4).
// The renderer never uses a color literal; the UI reads the same values as CSS
// variables (applyThemeVars). tests/theme.test.ts enforces the contrast rules.

import type { ColorToken } from '../engine/types';

export interface Theme {
  name: 'light' | 'dark';
  // canvas
  bg: string;
  given: string;
  constructed: string;
  aux: string;
  accent: string; // hover, selection, previews, picked inputs
  label: string;
  measure: string;
  colors: Record<Exclude<ColorToken, 'default'>, string>;
  // UI chrome
  panel: string;
  panelBorder: string;
  text: string;
  textMuted: string;
  buttonHover: string;
  buttonActive: string;
  buttonActiveText: string;
  danger: string;
  success: string;
  shadow: string;
}

export const LIGHT: Theme = {
  name: 'light',
  bg: '#f4f5f7',
  given: '#16181d',
  constructed: '#565a62',
  aux: '#7b8089',
  accent: '#2463d6',
  label: '#1b1e24',
  measure: '#1d4fbf',
  colors: { blue: '#2463d6', red: '#c62828', green: '#1b7a3a', orange: '#b8520f' },
  panel: '#ffffff',
  panelBorder: '#e1e3e8',
  text: '#1b1e24',
  textMuted: '#5d626b',
  buttonHover: '#eef0f4',
  buttonActive: '#2463d6',
  buttonActiveText: '#ffffff',
  danger: '#c62828',
  success: '#1b7a3a',
  shadow: '0 2px 10px rgba(20, 24, 32, 0.10), 0 1px 2px rgba(20, 24, 32, 0.06)',
};

export const DARK: Theme = {
  name: 'dark',
  bg: '#15171b',
  given: '#f1f3f5',
  constructed: '#aeb3bb',
  aux: '#868c96',
  accent: '#6aa7ff',
  label: '#eceef1',
  measure: '#8fbcff',
  colors: { blue: '#6aa7ff', red: '#ff7b7b', green: '#5fd38a', orange: '#ffa25a' },
  panel: '#1f2228',
  panelBorder: '#30343c',
  text: '#eceef1',
  textMuted: '#a2a8b1',
  buttonHover: '#2a2e35',
  buttonActive: '#6aa7ff',
  buttonActiveText: '#0d1117',
  danger: '#ff7b7b',
  success: '#5fd38a',
  shadow: '0 2px 12px rgba(0, 0, 0, 0.45)',
};

export function objectColor(t: Theme, token: ColorToken | undefined, given: boolean): string {
  if (token && token !== 'default') return t.colors[token];
  return given ? t.given : t.constructed;
}

export function applyThemeVars(t: Theme): void {
  const r = document.documentElement.style;
  const set = (k: string, val: string) => r.setProperty(`--${k}`, val);
  set('bg', t.bg);
  set('panel', t.panel);
  set('panel-border', t.panelBorder);
  set('text', t.text);
  set('text-muted', t.textMuted);
  set('accent', t.accent);
  set('btn-hover', t.buttonHover);
  set('btn-active', t.buttonActive);
  set('btn-active-text', t.buttonActiveText);
  set('danger', t.danger);
  set('success', t.success);
  set('shadow', t.shadow);
  set('measure', t.measure);
  document.documentElement.dataset.theme = t.name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
}

// ---- WCAG contrast ----------------------------------------------------------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
