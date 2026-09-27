import type { JSX } from 'react';
import type { ToolKey } from '../tools';

// Tool icons. Style rules (Euclidea-inspired, drawn from scratch):
//  - 24×24 grid, content inside 3…21, one color (currentColor), round caps.
//  - THIN stroke = what you pick / context; BOLD stroke = what the tool creates.
//  - Hollow dots = points you pick; a filled dot = a point the tool creates. No text inside icons.
// The main bar (Tier A) follows these rules; the More-drawer icons below are being
// redrawn group by group (see IconGallery, open the app with ?icons).

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const thin = { ...S, strokeWidth: 1.3 };
const bold = { ...S, strokeWidth: 1.8 };
const dot = (cx: number, cy: number, r = 1.9, filled = false) => (
  <circle cx={cx} cy={cy} r={r} fill={filled ? 'currentColor' : 'var(--icon-bg, #fff)'} stroke="currentColor" strokeWidth={1.4} />
);
/** A picked point: hollow, drawn on top so lines stop at its rim. */
const pt = (cx: number, cy: number) => <circle cx={cx} cy={cy} r={2.1} fill="var(--icon-bg, #fff)" stroke="currentColor" strokeWidth={1.35} />;
/** A point the tool creates: filled. */
const made = (cx: number, cy: number, r = 2.4) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;
const acc = { ...S, stroke: 'var(--accent)' };

const TOOL_ICONS: Record<ToolKey, JSX.Element> = {
  // ---- main bar ----
  // hand: Lucide "hand" (ISC license, see THIRD_PARTY_NOTICES.md)
  move: (
    <path
      {...S}
      strokeWidth={1.6}
      d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
    />
  ),
  point: <circle cx={12} cy={12} r={3.6} fill="var(--icon-bg, #fff)" stroke="currentColor" strokeWidth={1.6} />,
  line: (
    <>
      <path {...bold} d="M3 21L21 3" />
      {pt(8, 16)}
      {pt(16, 8)}
    </>
  ),
  circle: (
    <>
      <circle {...bold} cx={12} cy={12} r={8.5} />
      {pt(12, 12)}
      {pt(18, 6)}
    </>
  ),
  perpBisector: (
    <>
      <path {...thin} d="M4.5 12h15" />
      <path {...bold} d="M12 3v18" />
      {pt(4.5, 12)}
      {pt(19.5, 12)}
    </>
  ),
  perpendicular: (
    <>
      <path {...thin} d="M3 19h18" />
      <path {...bold} d="M12 19V3" />
      {pt(12, 9)}
    </>
  ),
  angleBisector: (
    <>
      <path {...thin} d="M4 19L19 4M4 19h17" />
      <path {...bold} d="M4 19L21 12" />
      {pt(4, 19)}
    </>
  ),
  parallel: (
    <>
      <path {...thin} d="M3 14L14 3" />
      <path {...bold} d="M10 21L21 10" />
      {pt(15.5, 15.5)}
    </>
  ),
  compass: (
    <>
      {/* the drawing instrument: a hinge, two legs, a brace (needle left, pencil right) */}
      <path {...bold} d="M11 6.6L5.5 20.5M13 6.6l5.5 13.9" />
      <path {...thin} d="M8.3 14.2c2.4 1.3 5 1.3 7.4 0" />
      <path {...thin} d="M12 1.8v1" />
      {pt(12, 4.6)}
    </>
  ),
  intersect: (
    <>
      <path {...thin} d="M4 4l16 16M20 4L4 20" />
      <circle cx={12} cy={12} r={3.2} fill="var(--icon-bg, #fff)" stroke="currentColor" strokeWidth={1.8} />
    </>
  ),

  // ---- More drawer (to be redrawn) ----
  // ---- More: Construct (new style) ----
  // Line family: Line runs past both points; Ray starts at a point; Segment stops at both.
  segment: (
    <>
      <path {...bold} d="M5 19L19 5" />
      {pt(5, 19)}
      {pt(19, 5)}
    </>
  ),
  ray: (
    <>
      <path {...bold} d="M5 19L21 3" />
      {pt(5, 19)}
      {pt(12, 12)}
    </>
  ),
  vector: (
    <>
      <path {...bold} d="M5 19L19 5M11.5 5H19v7.5" />
      {pt(5, 19)}
    </>
  ),
  midpoint: (
    <>
      <path {...thin} d="M4 12h16" />
      {pt(4, 12)}
      {pt(20, 12)}
      {made(12, 12)}
    </>
  ),
  tangents: (
    <>
      <circle {...thin} cx={9.5} cy={14.5} r={6} />
      <path {...bold} d="M21.5 5L14.3 18.24M21.5 5L6.95 8.97" />
      {pt(21.5, 5)}
    </>
  ),
  // ---- More: Polygons (GeoGebra's ideas, our style) ----
  polygon: (
    <>
      <path d="M4 19L20 17L11 5Z" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path {...bold} d="M4 19L20 17L11 5Z" />
      {pt(4, 19)}
      {pt(20, 17)}
      {pt(11, 5)}
    </>
  ),
  regularPolygon: (
    <>
      {/* you pick two corners (hollow); the tool creates the rest (filled) */}
      <path d="M20.5 12L16.25 19.36H7.75L3.5 12L7.75 4.64H16.25Z" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path {...bold} d="M20.5 12L16.25 19.36H7.75L3.5 12L7.75 4.64H16.25Z" />
      {made(20.5, 12, 2)}
      {made(3.5, 12, 2)}
      {made(7.75, 4.64, 2)}
      {made(16.25, 4.64, 2)}
      {pt(7.75, 19.36)}
      {pt(16.25, 19.36)}
    </>
  ),
  // ---- More: Circles (new style) ----
  semicircle: (
    <>
      <path {...thin} d="M4 16h16" />
      <path {...bold} d="M4 16a8 8 0 0 1 16 0" />
      {pt(4, 16)}
      {pt(20, 16)}
    </>
  ),
  sector: (
    <>
      <path d="M6 18H20A14 14 0 0 0 12.57 5.64Z" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path {...thin} d="M20 18H6L12.57 5.64" />
      <path {...bold} d="M20 18A14 14 0 0 0 12.57 5.64" />
      {pt(6, 18)}
    </>
  ),
  // ---- More: Transform (GeoGebra's ideas, our style): thin = original, bold + fill = image ----
  reflectLine: (
    <>
      <path {...thin} d="M12 3v18" strokeDasharray="2 2" />
      <path {...thin} d="M4 18h5V7z" />
      <path d="M20 18h-5V7z" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path {...bold} d="M20 18h-5V7z" />
    </>
  ),
  reflectPoint: (
    <>
      <path {...thin} d="M3 3h7L3 10z" />
      <path d="M21 21h-7l7-7z" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path {...bold} d="M21 21h-7l7-7z" />
      {pt(12, 12)}
    </>
  ),
  translate: (
    <>
      <path {...thin} d="M3 21h7l-7-7z" />
      <path d="M12 11h7l-7-7z" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path {...bold} d="M12 11h7l-7-7z" />
      <path {...thin} d="M13.5 20.5l6.5-6.5M16.3 14H20v3.7" />
    </>
  ),
  rotate: (
    <>
      {/* original (left) turned a quarter-turn clockwise about the point (bottom) */}
      <path {...thin} d="M9 15H4l5-5z" />
      <path d="M15 15v-5l5 5z" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path {...bold} d="M15 15v-5l5 5z" />
      <path {...thin} d="M6 7.6A12 12 0 0 1 18 7.6M15.03 7.74L18 7.6l-1.37-2.64" />
      {pt(12, 18)}
    </>
  ),
  dilate: (
    <>
      <path {...thin} d="M3 21L21 13M3 21L9 3" strokeDasharray="1.6 1.8" />
      <path {...thin} d="M5.4 17.8h4.8l-4.8-4z" />
      <path d="M9 13h12L9 3z" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path {...bold} d="M9 13h12L9 3z" />
      {pt(3, 21)}
    </>
  ),
  segmentLength: (
    <>
      <path {...acc} d="M4 16h16M4 13v6M20 13v6" />
      <text x={9} y={10} fontSize={7} fill="currentColor" fontFamily="Nunito, sans-serif" fontWeight={700}>
        2
      </text>
    </>
  ),
  circleRadius: (
    <>
      <circle {...acc} cx={12} cy={12} r={8} />
      <path {...S} d="M12 12h8" />
      {dot(12, 12)}
      <text x={13} y={10.5} fontSize={6} fill="currentColor" fontFamily="Nunito, sans-serif" fontWeight={700}>
        r
      </text>
    </>
  ),
  angleSize: (
    <>
      <path {...S} d="M4 19h16" />
      <path {...acc} d="M4 19L16 6" />
      <path {...S} d="M10 19a6 6 0 0 0-1.9-4.4" />
      <text x={13} y={16} fontSize={6} fill="currentColor" fontFamily="Nunito, sans-serif" fontWeight={700}>
        °
      </text>
    </>
  ),
  rotateBy: (
    <>
      <path {...acc} d="M19 12a7 7 0 1 1-2.1-5" />
      <path {...acc} d="M17.5 3v4.2h-4.2" />
      <text x={8.5} y={15} fontSize={7} fill="currentColor" fontFamily="Nunito, sans-serif" fontWeight={700}>
        °
      </text>
    </>
  ),
  dilateBy: (
    <>
      <path {...S} d="M3 21l4-6h4z" />
      <path {...acc} d="M3 21l9-13h8z" />
      <text x={14} y={20} fontSize={6.5} fill="currentColor" fontFamily="Nunito, sans-serif" fontWeight={700}>
        ×2
      </text>
    </>
  ),
  measureDistance: (
    <>
      <path {...S} d="M3 15.5L15.5 3 21 8.5 8.5 21z" />
      <path {...acc} d="M7 12l2 2M9.5 9.5l1.5 1.5M12 7l2 2M14.5 4.5L16 6" />
    </>
  ),
  measureAngle: (
    <>
      <path {...S} d="M4 19h16M4 19L15 5" />
      <path {...acc} d="M11 19a7 7 0 0 0-2.7-5.5" />
    </>
  ),
  measureArea: (
    <>
      <path {...S} d="M4 4h16v16H4z" />
      <path {...acc} d="M4 12l8-8M4 20L20 4M12 20l8-8" strokeWidth={1.2} />
    </>
  ),
  label: (
    <text x={5.5} y={18} fontSize={15} fill="currentColor" fontStyle="italic" fontFamily="'STIX Two Text', serif">
      A
    </text>
  ),
  showHide: (
    <>
      <path {...S} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle {...acc} cx={12} cy={12} r={3} />
    </>
  ),
  delete: <path {...S} d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />,
};

export function ToolIcon({ tool, size = 24 }: { tool: ToolKey; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {TOOL_ICONS[tool]}
    </svg>
  );
}

const UI: Record<string, JSX.Element> = {
  menu: <path {...S} d="M4 7h16M4 12h16M4 17h16" />,
  undo: <path {...S} d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  redo: <path {...S} d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
  more: (
    <>
      <circle cx={5.5} cy={12} r={1.6} fill="currentColor" />
      <circle cx={12} cy={12} r={1.6} fill="currentColor" />
      <circle cx={18.5} cy={12} r={1.6} fill="currentColor" />
    </>
  ),
  // open book: the steps record (distinct from the ☰ menu)
  steps: <path {...S} d="M12 7v13M12 7c-1.8-1.6-4.6-2.4-8.5-2.4v13c3.9 0 6.7.8 8.5 2.4 1.8-1.6 4.6-2.4 8.5-2.4v-13C16.6 4.6 13.8 5.4 12 7z" />,
  // restore moved points (Euclidea's reset idea): a center dot with two arrows circling it
  restorePoints: (
    <>
      <circle cx={12} cy={12} r={2.2} fill="currentColor" />
      <path {...S} strokeWidth={1.8} d="M4.12 10.61A8 8 0 0 1 18.93 8M19.88 13.39A8 8 0 0 1 5.07 16" />
      <path {...S} strokeWidth={1.8} d="M15.9 6.75L18.93 8l.43-3.25M8.1 17.25L5.07 16l-.43 3.25" />
    </>
  ),
  sun: (
    <>
      <circle {...S} cx={12} cy={12} r={4} />
      <path {...S} d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path {...S} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  close: <path {...S} d="M6 6l12 12M18 6L6 18" />,
  plus: <path {...S} d="M12 5v14M5 12h14" />,
  minus: <path {...S} d="M5 12h14" />,
  pin: <path {...S} d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6" />,
  eye: (
    <>
      <path {...S} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle {...S} cx={12} cy={12} r={3} />
    </>
  ),
  eyeOff: <path {...S} d="M4 4l16 16M10.5 6a9.8 9.8 0 0 1 1.5-.1c6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-2.7 3.4M6.6 7.6C4 9.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1M9.9 10a3 3 0 0 0 4.2 4.2" />,
  trash: <path {...S} d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />,
  play: <path {...S} d="M8 5l11 7-11 7z" />,
  pause: <path {...S} d="M8 5v14M16 5v14" strokeWidth={2.2} />,
  fit: <path {...S} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  note: <path {...S} d="M5 19h4L19.5 8.5a2.1 2.1 0 0 0-3-3L6 16z" />,
  check: <path {...S} d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle {...S} cx={11} cy={11} r={6} />
      <path {...S} d="M20 20l-4.5-4.5" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: keyof typeof UI; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {UI[name]}
    </svg>
  );
}
