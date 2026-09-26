import { useEffect, useMemo, useRef, useState } from 'react';
import { isToolAllowed, setTool, togglePin, useApp } from '../store';
import { MAIN_BAR, MAX_PINS, MORE_GROUPS, TOOL_BY_KEY, TOOLS, type ToolKey, type ToolUI } from '../tools';
import { Icon, ToolIcon } from './Icons';

function tooltip(t: ToolUI) {
  return `${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`;
}

export function Toolbar() {
  const tool = useApp((s) => s.tool);
  const pins = useApp((s) => s.settings.pins);
  const lastMore = useApp((s) => s.lastMore);
  const moreOpen = useApp((s) => s.moreOpen);
  const picks = useApp((s) => s.session.picks);
  const readOnly = useApp((s) => s.readOnly);
  useApp((s) => `${s.doc.problemId ?? ''}|${s.settings.strict}`); // re-render when the allowed tools change
  const t = TOOL_BY_KEY[tool];
  const extra = [...pins, ...(lastMore && !pins.includes(lastMore) ? [lastMore] : [])].filter((k) => !MAIN_BAR.includes(k));
  const hint = readOnly ? 'Viewing a shared construction · pan and zoom, or replay the steps' : t.hint(picks);

  const btn = (k: ToolKey) => {
    const ui = TOOL_BY_KEY[k];
    const allowed = isToolAllowed(k);
    return (
      <button
        key={k}
        className={`tool-btn${tool === k ? ' active' : ''}`}
        data-tool={k}
        title={allowed ? tooltip(ui) : `${ui.label}: not available here`}
        aria-label={ui.label}
        aria-pressed={tool === k}
        disabled={!allowed}
        onClick={() => setTool(k)}
      >
        <ToolIcon tool={k} size={26} />
      </button>
    );
  };

  return (
    <div className="bottom">
      <div className="hint" data-testid="hint" aria-live="polite">
        {hint}
      </div>
      <div className="toolbar" role="toolbar" aria-label="Tools">
        {MAIN_BAR.map(btn)}
        {extra.length > 0 && <span className="sep" />}
        {extra.map(btn)}
        <button
          className={`tool-btn${moreOpen ? ' active' : ''}`}
          title="More tools (M)"
          aria-label="More tools"
          aria-expanded={moreOpen}
          data-tool="more"
          disabled={readOnly}
          onClick={() => useApp.setState({ moreOpen: !moreOpen, menuOpen: false })}
        >
          <Icon name="more" size={24} />
        </button>
      </div>
      {moreOpen && <MoreDrawer />}
    </div>
  );
}

function MoreDrawer() {
  const [q, setQ] = useState('');
  const tool = useApp((s) => s.tool);
  const pins = useApp((s) => s.settings.pins);
  const input = useRef<HTMLInputElement>(null);
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  useEffect(() => {
    if (!coarse) input.current?.focus(); // don't pop the phone keyboard over the drawer
  }, [coarse]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return TOOLS.filter((t) => t.group !== 'main' && (!s || `${t.label} ${t.keywords ?? ''}`.toLowerCase().includes(s)));
  }, [q]);

  const longPress = useRef<number | null>(null);
  const item = (t: ToolUI) => {
    const allowed = isToolAllowed(t.key);
    return (
      <button
        key={t.key}
        className={`more-item${tool === t.key ? ' active' : ''}`}
        data-tool={t.key}
        disabled={!allowed}
        title={`${tooltip(t)} · right-click or long-press to pin`}
        onClick={() => setTool(t.key)}
        onContextMenu={(e) => {
          e.preventDefault();
          togglePin(t.key, MAX_PINS);
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'touch') return;
          longPress.current = window.setTimeout(() => {
            longPress.current = null;
            togglePin(t.key, MAX_PINS);
          }, 550);
        }}
        onPointerUp={() => longPress.current && clearTimeout(longPress.current)}
        onPointerLeave={() => longPress.current && clearTimeout(longPress.current)}
      >
        {pins.includes(t.key) && (
          <span className="pinned" aria-label="pinned">
            <Icon name="pin" size={12} />
          </span>
        )}
        <ToolIcon tool={t.key} size={26} />
        <span className="name">{t.label}</span>
      </button>
    );
  };

  return (
    <div className="panel more" role="dialog" aria-label="More tools">
      <div className="more-search">
        <Icon name="search" size={18} />
        <input
          ref={input}
          value={q}
          placeholder="Find a tool…"
          aria-label="Find a tool"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0] && isToolAllowed(matches[0].key)) setTool(matches[0].key);
            if (e.key === 'Escape') useApp.setState({ moreOpen: false });
            e.stopPropagation();
          }}
        />
      </div>
      <div className="more-body">
        {MORE_GROUPS.map(({ group, title }) => {
          const items = matches.filter((t) => t.group === group);
          if (!items.length) return null;
          return (
            <div className="more-group" key={group}>
              <h4>{title}</h4>
              <div className="more-items">{items.map(item)}</div>
            </div>
          );
        })}
        {!matches.length && <div className="empty">No tool matches “{q}”.</div>}
      </div>
      <div className="more-foot muted">Right-click or long-press a tool to pin it to the bar (up to {MAX_PINS}).</div>
    </div>
  );
}
