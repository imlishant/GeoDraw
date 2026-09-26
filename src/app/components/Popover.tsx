import { useEffect, useState } from 'react';
import type { ColorToken, GeoObject } from '../../engine/types';
import { setObjectsPatch } from '../../engine/doc';
import { applyPatch, problemOf, useApp } from '../store';
import { deleteWithConfirm, controller } from '../controller';

const COLORS: ColorToken[] = ['default', 'blue', 'red', 'green', 'orange'];

/** Small card next to the selected object: name, label, color, dashed, hide, delete. */
export function SelectionPopover() {
  const selection = useApp((s) => s.selection);
  const at = useApp((s) => s.popoverAt);
  const doc = useApp((s) => s.doc);
  const readOnly = useApp((s) => s.readOnly);
  const o = selection.length === 1 ? doc.objects[selection[0]] : undefined;
  const [name, setName] = useState(o?.name ?? '');
  useEffect(() => setName(o?.name ?? ''), [o?.id, o?.name]);
  if (!o || !at || readOnly) return null;
  const locked = !!problemOf(doc) && !!o.given;

  const update = (patch: Partial<GeoObject>, label: string) => applyPatch(setObjectsPatch(doc, [{ ...o, ...patch } as GeoObject], label));
  const commitName = () => {
    const n = name.trim();
    if (!n || n === o.name) return setName(o.name);
    if (Object.values(doc.objects).some((x) => x.id !== o.id && x.name === n)) return setName(o.name);
    update({ name: n, showLabel: true }, 'Rename');
  };

  const w = 236;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(8, at.x + 16), vw - w - 8);
  const top = Math.min(Math.max(70, at.y + 16), vh - 260);
  const theme = controller.theme;
  const colorOf = (c: ColorToken) => (c === 'default' ? (o.given ? theme.given : theme.constructed) : theme.colors[c]);

  return (
    <div className="panel popover" style={{ left, top }} role="dialog" aria-label={`Object ${o.name}`} onPointerDown={(e) => e.stopPropagation()}>
      <input
        className="name-input"
        value={name}
        aria-label="Name"
        disabled={locked}
        autoFocus={useApp.getState().tool === 'label'}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') useApp.setState({ popoverAt: null });
        }}
      />
      {!locked && (
        <>
          <div className="line" role="radiogroup" aria-label="Color">
            {COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={(o.style?.color ?? 'default') === c}
                aria-label={c}
                className={`color${(o.style?.color ?? 'default') === c ? ' on' : ''}`}
                style={{ background: colorOf(c) }}
                onClick={() => update({ style: { ...o.style, color: c } }, 'Color')}
              />
            ))}
          </div>
          <div className="line">
            <button className={`chip${(o.kind === 'point' ? o.showLabel !== false : !!o.showLabel) ? ' on' : ''}`} onClick={() => update({ showLabel: !(o.kind === 'point' ? o.showLabel !== false : !!o.showLabel) }, 'Label')}>
              Label
            </button>
            {o.kind !== 'point' && o.kind !== 'region' && (
              <button className={`chip${o.style?.dashed ? ' on' : ''}`} onClick={() => update({ style: { ...o.style, dashed: !o.style?.dashed } }, 'Dashed')}>
                Dashed
              </button>
            )}
            <button className="chip" onClick={() => update({ hidden: !o.hidden }, o.hidden ? 'Show' : 'Hide')}>
              {o.hidden ? 'Show' : 'Hide'}
            </button>
            <button className="chip danger" onClick={() => deleteWithConfirm([o.id])}>
              Delete
            </button>
          </div>
        </>
      )}
      {locked && <span className="def">Given object (part of the problem)</span>}
    </div>
  );
}
