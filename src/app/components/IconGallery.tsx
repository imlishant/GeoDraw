import { MAIN_BAR, MORE_GROUPS, TOOLS, TOOL_BY_KEY, type ToolKey } from '../tools';
import { DARK, LIGHT, type Theme } from '../../render/theme';
import { ToolIcon } from './Icons';

// Review sheet for the tool icons (open the app with ?icons). Every icon at
// 16/24/32/48 px, normal and active, in light and dark.

function Row({ k, t }: { k: ToolKey; t: Theme }) {
  const cell = (active: boolean, size: number) => (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size + 22,
        height: size + 22,
        borderRadius: 12,
        background: active ? t.buttonActive : t.panel,
        border: `1px solid ${active ? t.buttonActive : t.panelBorder}`,
        color: active ? t.buttonActiveText : t.accent,
        ['--icon-bg' as string]: active ? t.buttonActive : t.panel,
      }}
    >
      <ToolIcon tool={k} size={size} />
    </span>
  );
  return (
    <div data-icon={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{ width: 170, fontWeight: 700, fontSize: 13, color: t.text }}>{TOOL_BY_KEY[k].label}</span>
      {[16, 24, 32, 48].map((s) => (
        <span key={s}>{cell(false, s)}</span>
      ))}
      {cell(true, 26)}
    </div>
  );
}

function Sheet({ t, keys }: { t: Theme; keys: ToolKey[] }) {
  return (
    <div style={{ background: t.bg, padding: 20, flex: 1 }}>
      {keys.map((k) => (
        <Row key={k} k={k} t={t} />
      ))}
    </div>
  );
}

export function IconGallery() {
  const group = new URLSearchParams(location.search).get('group');
  const sections: Array<{ title: string; keys: ToolKey[] }> = [
    { title: 'Main bar', keys: MAIN_BAR },
    ...MORE_GROUPS.map((g) => ({ title: g.title, keys: TOOLS.filter((x) => x.group === g.group).map((x) => x.key) })),
  ].filter((s) => !group || s.title.toLowerCase().startsWith(group.toLowerCase()));
  return (
    <div style={{ fontFamily: 'Nunito, sans-serif', overflow: 'auto', height: '100%' }}>
      {sections.map((s) => (
        <section key={s.title} data-section={s.title}>
          <h2 style={{ margin: 0, padding: '14px 20px 0', background: LIGHT.bg, color: LIGHT.text, fontSize: 16 }}>{s.title}</h2>
          <div style={{ display: 'flex' }}>
            <Sheet t={LIGHT} keys={s.keys} />
            <Sheet t={DARK} keys={s.keys} />
          </div>
        </section>
      ))}
    </div>
  );
}
