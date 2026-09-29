import { useEffect, useRef, useState } from 'react';
import type { GeoObject, Step } from '../../engine/types';
import { setObjectsPatch } from '../../engine/doc';
import { measureRefs } from '../../engine/doc';
import { measureValue } from '../../engine/measure';
import { applyPatch, closePanels, togglePanel, useApp } from '../store';
import { describeStep } from '../describe';
import { formatNumber } from '../format';
import { Icon } from './Icons';
import { objectColor } from '../../render/theme';
import { controller } from '../controller';

export function StepsButton() {
  const open = useApp((s) => s.stepsOpen);
  const n = useApp((s) => s.doc.steps.length);
  return (
    <button
      className="icon-btn steps-btn"
      aria-label={`Steps (${n})`}
      title="Steps, objects & measures"
      aria-expanded={open}
      data-testid="steps-button"
      onClick={() => togglePanel('steps')}
    >
      <Icon name="steps" />
    </button>
  );
}

export function StepsDrawer() {
  const open = useApp((s) => s.stepsOpen);
  const tab = useApp((s) => s.stepsTab);
  if (!open) return null;
  return (
    <div className="panel drawer" role="complementary" aria-label="Construction panel">
      <div className="tabs" role="tablist">
        {(['steps', 'objects', 'measures'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => useApp.setState({ stepsTab: t })}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <span className="spacer" />
        <button aria-label="Close panel" onClick={closePanels}>
          <Icon name="close" size={18} />
        </button>
      </div>
      {tab === 'steps' && <StepsTab />}
      {tab === 'objects' && <ObjectsTab />}
      {tab === 'measures' && <MeasuresTab />}
    </div>
  );
}

function StepsTab() {
  const doc = useApp((s) => s.doc);
  const scrub = useApp((s) => s.scrub);
  const readOnly = useApp((s) => s.readOnly);
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const n = doc.steps.length;
  const pos = scrub ?? n;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      const cur = useApp.getState().scrub ?? 0;
      if (cur >= n) {
        setPlaying(false);
        useApp.setState({ scrub: null });
      } else useApp.setState({ scrub: cur + 1 });
    }, 900);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, n]);

  const setNote = (st: Step, note: string) => {
    const steps = doc.steps.map((x) => (x.id === st.id ? { ...x, note: note || undefined } : x));
    applyPatch({ label: 'Note', steps: [doc.steps, steps] });
  };

  if (!n) {
    return (
      <div className="empty">
        No steps yet.
        <br />
        Every line, circle and point you construct is recorded here, so you can replay how you solved it.
      </div>
    );
  }
  return (
    <>
      <div className="scrubber">
        <button
          className="plain-btn"
          aria-label={playing ? 'Pause replay' : 'Replay steps'}
          onClick={() => {
            if (!playing && (scrub === null || scrub >= n)) useApp.setState({ scrub: 0 });
            setPlaying(!playing);
          }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </button>
        <input
          type="range"
          min={0}
          max={n}
          value={pos}
          aria-label="Replay position"
          onChange={(e) => {
            setPlaying(false);
            const v = Number(e.target.value);
            useApp.setState({ scrub: v >= n ? null : v });
          }}
        />
        <span className="muted" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>
          {pos}/{n}
        </span>
      </div>
      <div className="drawer-body" data-testid="steps-list">
        {doc.steps.map((st, i) => (
          <div
            key={st.id}
            className={`row${i >= pos ? ' dim' : ''}`}
            onMouseEnter={() => useApp.setState({ stepHover: st.outputs })}
            onMouseLeave={() => useApp.setState({ stepHover: [] })}
            onClick={() => useApp.setState({ scrub: i + 1 >= n ? null : i + 1 })}
          >
            <span className="idx">{i + 1}</span>
            <span className="desc">
              {describeStep(doc, st)}
              {editing === st.id ? (
                <input
                  className="note-input"
                  autoFocus
                  defaultValue={st.note ?? ''}
                  placeholder="Why this step?"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  onBlur={(e) => {
                    setNote(st, e.target.value.trim());
                    setEditing(null);
                  }}
                />
              ) : (
                st.note && <span className="note">{st.note}</span>
              )}
            </span>
            {!readOnly && (
              <span className="row-actions">
                <button
                  aria-label="Add a note"
                  title="Add a note"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(st.id);
                  }}
                >
                  <Icon name="note" size={15} />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
</>
  );
}

function defSummary(o: GeoObject, name: (id: string) => string): string {
  const d = o.def as unknown as Record<string, unknown>;
  const t = d.t as string;
  const refs = Object.entries(d)
    .filter(([k, v]) => k !== 't' && typeof v === 'string')
    .map(([, v]) => name(v as string));
  const label: Record<string, string> = {
    free: 'free point',
    on: 'point on',
    int: 'intersection of',
    mid: 'midpoint of',
    center: 'center of',
    thru: o.kind === 'line' ? (o.clip === 'segment' ? 'segment' : o.clip === 'ray' ? 'ray' : 'line') : 'through',
    perpBis: 'perpendicular bisector of',
    perp: 'perpendicular to',
    par: 'parallel to',
    angBis: 'angle bisector',
    tangent: 'tangent from',
    ctr: 'circle',
    compass: 'compass',
    compassC: 'compass',
    radius: 'circle with radius',
    semi: 'semicircle on',
    sector: 'sector',
    xf: 'image of',
    poly: 'polygon',
    polar: 'fixed length from',
    rotNum: 'angle at',
    regVertex: 'regular polygon vertex',
  };
  const pts = o.kind === 'region' ? (o.def.pts as string[]).map(name) : [];
  return `${label[t] ?? t} ${[...refs, ...pts].join(', ')}`.trim();
}

function ObjectsTab() {
  const doc = useApp((s) => s.doc);
  const values = useApp((s) => s.values);
  const selection = useApp((s) => s.selection);
  const readOnly = useApp((s) => s.readOnly);
  const name = (id: string) => doc.objects[id]?.name ?? '?';
  if (!doc.order.length) return <div className="empty">Nothing here yet.</div>;
  return (
    <div className="drawer-body">
      {doc.order.map((id) => {
        const o = doc.objects[id];
        const undef = !values.get(id);
        return (
          <div
            key={id}
            className={`row${o.hidden || undef ? ' dim' : ''}`}
            style={selection.includes(id) ? { background: 'var(--btn-hover)' } : undefined}
            onClick={() => useApp.setState({ selection: [id] })}
            onMouseEnter={() => useApp.setState({ stepHover: [id] })}
            onMouseLeave={() => useApp.setState({ stepHover: [] })}
          >
            <span className="swatch" style={{ background: objectColor(controller.theme, o.style?.color) }} />
            <span className="desc">
              <em>{o.name}</em> <span className="def">{defSummary(o, name)}</span>
              {undef && <span className="def"> · undefined here</span>}
            </span>
            {!readOnly && (
              <span className="row-actions">
                <button
                  aria-label={o.hidden ? `Show ${o.name}` : `Hide ${o.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    applyPatch(setObjectsPatch(doc, [{ ...o, hidden: !o.hidden }], o.hidden ? 'Show' : 'Hide'));
                  }}
                >
                  <Icon name={o.hidden ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MeasuresTab() {
  const doc = useApp((s) => s.doc);
  const values = useApp((s) => s.values);
  const decimals = useApp((s) => s.settings.decimals);
  const readOnly = useApp((s) => s.readOnly);
  if (!doc.measures.length) {
    return (
      <div className="empty">
        No measurements yet.
        <br />
        Use More → Measure (distance, angle, area). Values update live while you drag.
      </div>
    );
  }
  const name = (id: string) => doc.objects[id]?.name ?? '?';
  return (
    <div className="drawer-body" data-testid="measures-list">
      {doc.measures.map((m) => {
        const v = measureValue(m, values);
        const refs = measureRefs(m).map(name);
        const label = m.t === 'distance' ? `|${refs.join('')}|` : m.t === 'angle' ? `∠${refs.join('')}` : `Area ${refs[0]}`;
        return (
          <div className="row" key={m.id}>
            <span className="desc">
              <em>{label}</em>
            </span>
            <span className="measure-value">{v.value === null ? '—' : `${formatNumber(v.value, decimals)}${v.unit}`}</span>
            {!readOnly && (
              <span className="row-actions">
                <button aria-label="Remove measurement" onClick={() => applyPatch({ label: 'Remove measure', measures: [doc.measures, doc.measures.filter((x) => x.id !== m.id)] })}>
                  <Icon name="close" size={15} />
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
