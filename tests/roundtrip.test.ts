import { describe, expect, it } from 'vitest';
import { Scratch } from './scratch';
import { evaluateDoc } from '../src/engine/evaluate';
import { docToJSON, parseDoc } from '../src/engine/serialize';
import { embedInPng, extractFromPng } from '../src/render/export';
import { decodeShare, encodeShare } from '../src/app/persistence/share';
import type { Doc } from '../src/engine/types';

// A construction using every tool, then every save format must bring it back identically.
function everything(): Doc {
  const s = new Scratch();
  const [A, B, Cp, D, E] = [s.free(-120, 0), s.free(100, 10), s.free(0, 130), s.free(-60, -90), s.free(210, 160)];
  const ln = s.tool('line', [A, B])[0];
  const k = s.tool('circle', [A, B])[0];
  s.tool('segment', [A, Cp]);
  s.tool('ray', [B, Cp]);
  s.tool('vector', [D, E]);
  s.tool('perpBisector', [A, B]);
  s.tool('perpendicular', [ln, Cp]);
  s.tool('parallel', [ln, D]);
  s.tool('angleBisector', [A, Cp, B]);
  s.tool('compass', [A, Cp, B]);
  s.tool('intersect', [ln, k]);
  s.tool('midpoint', [A, Cp]);
  s.tool('tangents', [E, k]);
  s.tool('polygon', [A, B, Cp, A]);
  s.tool('semicircle', [D, B]);
  s.tool('sector', [Cp, A, B]);
  s.tool('reflectLine', [k, ln]);
  s.tool('reflectPoint', [Cp, A]);
  s.tool('translate', [ln, A, D]);
  s.tool('rotate', [Cp, A, D, B, E]);
  s.tool('dilate', [k, A, D, B]);
  s.tool('segmentLength', [E], 1.2);
  s.tool('circleRadius', [D], 0.7);
  s.tool('angleSize', [B, A], 30);
  s.tool('rotateBy', [ln, E], 45);
  s.tool('dilateBy', [Cp, D], 0.5);
  s.tool('regularPolygon', [D, E], 6);
  s.doc.measures.push({ id: 'm1', t: 'distance', a: A, b: B }, { id: 'm2', t: 'angle', a: A, v: Cp, b: B });
  s.doc.steps[0].note = 'Start with a line — and ünïcode ✓ A₁';
  return s.doc;
}

const geo = (d: Doc) => JSON.stringify([...evaluateDoc(d)]);

describe('save formats round-trip every tool', () => {
  const doc = everything();
  it('JSON', () => {
    const back = parseDoc(docToJSON(doc));
    expect(back.steps).toEqual(doc.steps);
    expect(geo(back)).toBe(geo(doc));
  });
  it('PNG (construction embedded in the image)', () => {
    // minimal valid PNG: signature + IHDR + IEND (content doesn't matter for embedding)
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    const back = extractFromPng(embedInPng(png, docToJSON(doc)))!;
    expect(back.steps).toEqual(doc.steps);
    expect(geo(back)).toBe(geo(doc));
  });
  it('share link', async () => {
    const token = await encodeShare(doc);
    expect(token.length).toBeLessThan(docToJSON(doc).length); // compressed
    const back = await decodeShare(token);
    expect(back.steps).toEqual(doc.steps);
    expect(geo(back)).toBe(geo(doc));
  });
  it('rejects broken or hostile files with a readable error', () => {
    expect(() => parseDoc('not json')).toThrow(/invalid JSON/);
    expect(() => parseDoc('{"schemaVersion": 2}')).toThrow(/schemaVersion/);
    const bad = JSON.parse(docToJSON(doc));
    bad.order = [...bad.order].reverse(); // children before parents
    expect(() => parseDoc(JSON.stringify(bad))).toThrow(/before it exists/);
  });
});
