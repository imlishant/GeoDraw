import { useEffect, useState, type ReactNode } from 'react';
import { PROBLEMS } from '../../engine/problems';
import { clearSession, toast, updateSettings, useApp, type Settings } from '../store';
import { openLocal, openProblem } from '../actions';
import { allProgress, deleteLocal, listLocal, type DocSummary, type Progress } from '../persistence/library';
import { cloudEnabled, currentUser, deleteCloud, listCloud, loadCloud, onAuthChange, signInWithEmail, signInWithGoogle, signOut, type CloudUser } from '../persistence/cloud';
import { loadDoc } from '../store';
import { Icon } from './Icons';
import { controller } from '../controller';

function Dialog({ title, children, onClose, size = '', actions }: { title: string; children: ReactNode; onClose: () => void; size?: '' | 'wide' | 'small'; actions?: ReactNode }) {
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`panel dialog ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="plain-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="body">{children}</div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Dialogs() {
  const dialog = useApp((s) => s.dialog);
  const close = () => useApp.setState({ dialog: null });
  return (
    <>
      <NumberPrompt />
      <ConfirmDialog />
      {dialog === 'settings' && <SettingsDialog onClose={close} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={close} />}
      {dialog === 'library' && <LibraryDialog onClose={close} />}
      {dialog === 'problems' && <ProblemsDialog onClose={close} />}
      {dialog === 'account' && <AccountDialog onClose={close} />}
      {dialog === 'about' && <AboutDialog onClose={close} />}
    </>
  );
}

function NumberPrompt() {
  const prompt = useApp((s) => s.prompt);
  const [value, setValue] = useState('');
  useEffect(() => setValue(prompt?.value ?? ''), [prompt]);
  if (!prompt) return null;
  const cancel = () => {
    useApp.setState({ prompt: null });
    clearSession();
  };
  const submit = () => {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n)) return toast('Enter a number', 'error');
    useApp.setState({ prompt: null });
    prompt.onSubmit(n);
  };
  return (
    <Dialog
      title={prompt.label}
      size="small"
      onClose={cancel}
      actions={
        <>
          <button className="secondary-btn" onClick={cancel}>
            Cancel
          </button>
          <button className="primary-btn" onClick={submit}>
            OK
          </button>
        </>
      }
    >
      <input
        className="number-input"
        inputMode="decimal"
        autoFocus
        value={value}
        aria-label={prompt.label}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') cancel();
        }}
      />
      {prompt.unit && <p className="muted">In {prompt.unit}.</p>}
    </Dialog>
  );
}

function ConfirmDialog() {
  const c = useApp((s) => s.confirm);
  if (!c) return null;
  const close = () => useApp.setState({ confirm: null });
  return (
    <Dialog
      title="Are you sure?"
      size="small"
      onClose={close}
      actions={
        <>
          <button className="secondary-btn" onClick={close} autoFocus>
            Cancel
          </button>
          <button
            className="danger-btn"
            onClick={() => {
              close();
              c.onConfirm();
            }}
          >
            {c.confirmLabel}
          </button>
        </>
      }
    >
      <p>{c.message}</p>
      <p className="muted">You can undo this.</p>
    </Dialog>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useApp((x) => x.settings);
  const set = (p: Partial<Settings>) => {
    updateSettings(p);
    controller.invalidate();
  };
  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="field">
        <span>Theme</span>
        <span className="seg">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} className={s.theme === t ? 'on' : ''} onClick={() => set({ theme: t })}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </span>
      </div>
      <div className="field">
        <span>
          Strict mode
          <small>Pure Euclid: only Point, Line, Circle and Intersect.</small>
        </span>
        <Switch label="Strict mode" on={s.strict} onChange={(v) => set({ strict: v })} />
      </div>
      <div className="field">
        <span>
          Point labels
          <small>Show names (A, B, C…) next to points.</small>
        </span>
        <Switch label="Point labels" on={s.pointLabels} onChange={(v) => set({ pointLabels: v })} />
      </div>
      <div className="field">
        <span>
          Measurements on the figure
          <small>Also draw measured values on the canvas.</small>
        </span>
        <Switch label="Measurements on the figure" on={s.canvasMeasures} onChange={(v) => set({ canvasMeasures: v })} />
      </div>
      <div className="field">
        <span>Decimal places</span>
        <span className="seg">
          {[2, 3, 4, 6].map((d) => (
            <button key={d} className={s.decimals === d ? 'on' : ''} onClick={() => set({ decimals: d })}>
              {d}
            </button>
          ))}
        </span>
      </div>
    </Dialog>
  );
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ['Move', 'V'],
    ['Point', 'P'],
    ['Line', 'L'],
    ['Circle', 'C'],
    ['Perpendicular bisector', 'B'],
    ['Perpendicular', 'T'],
    ['Angle bisector', 'G'],
    ['Parallel', 'A'],
    ['Compass', 'K'],
    ['Intersect', 'X'],
    ['Segment / Ray', 'S / Y'],
    ['More tools', 'M'],
    ['Cancel current tool input', 'Esc'],
    ['Close polygon', 'Enter'],
    ['Undo / Redo', '⌘/Ctrl+Z · ⌘/Ctrl+Shift+Z'],
    ['Delete selection', 'Delete'],
    ['Hide selection', 'H'],
    ['Zoom to fit / 100%', '1 / 0'],
    ['Zoom in / out', '+ / −'],
    ['Pan', 'Drag canvas · Space+drag · two fingers'],
    ['Zoom', 'Wheel · pinch'],
    ['Box select', 'Shift+drag (Move tool)'],
    ['Steps panel', 'J'],
  ];
  return (
    <Dialog title="Keyboard & gestures" onClose={onClose}>
      <div className="shortcuts">
        {rows.map(([a, b]) => (
          <div key={a} style={{ display: 'contents' }}>
            <span>{a}</span>
            <span>
              <kbd>{b}</kbd>
            </span>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

function LibraryDialog({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<DocSummary[] | null>(null);
  const [cloud, setCloud] = useState<DocSummary[] | null>(null);
  const [user, setUser] = useState<CloudUser | null>(null);
  const current = useApp((s) => s.doc.id);
  const refresh = () => void listLocal().then(setItems);
  useEffect(() => {
    refresh();
    if (cloudEnabled)
      void currentUser().then((u) => {
        setUser(u);
        if (u) listCloud().then(setCloud).catch(() => setCloud([]));
      });
  }, []);
  const problemTitle = (id?: string) => (id ? PROBLEMS.find((p) => p.id === id)?.title : undefined);
  return (
    <Dialog title="My constructions" size="wide" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Saved automatically in this browser{cloudEnabled ? (user ? ' and synced to your account' : '. Sign in (menu → Account) to sync across devices') : ''}.
      </p>
      {items === null ? (
        <div className="empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty">Nothing saved yet. Constructions are saved as soon as you draw something.</div>
      ) : (
        items.map((d) => (
          <div className="list-item" key={d.id}>
            <div className="grow">
              <div className="title">
                {d.title}
                {d.id === current && <span className="muted"> · open</span>}
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {problemTitle(d.problemId) ? `Problem: ${problemTitle(d.problemId)} · ` : ''}
                {d.stepCount} steps · {timeAgo(d.updatedAt)}
              </div>
            </div>
            <button
              className="secondary-btn"
              onClick={() => {
                onClose();
                void openLocal(d.id);
              }}
            >
              Open
            </button>
            <button
              className="plain-btn"
              aria-label={`Delete ${d.title}`}
              disabled={d.id === current}
              onClick={() =>
                useApp.setState({
                  confirm: { message: `Delete “${d.title}” from this browser?`, confirmLabel: 'Delete', onConfirm: () => void deleteLocal(d.id).then(refresh) },
                })
              }
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))
      )}
      {cloud && cloud.length > 0 && (
        <>
          <div className="group-title">In your account</div>
          {cloud.map((d) => (
            <div className="list-item" key={`c-${d.id}`}>
              <div className="grow">
                <div className="title">{d.title}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {d.stepCount} steps · {timeAgo(d.updatedAt)}
                </div>
              </div>
              <button
                className="secondary-btn"
                onClick={async () => {
                  const doc = await loadCloud(d.id);
                  if (doc) {
                    onClose();
                    loadDoc(doc);
                  }
                }}
              >
                Open
              </button>
              <button className="plain-btn" aria-label={`Delete ${d.title} from account`} onClick={() => void deleteCloud(d.id).then(() => listCloud().then(setCloud))}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
        </>
      )}
    </Dialog>
  );
}

function ProblemsDialog({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  useEffect(() => void allProgress().then(setProgress), []);
  const groups = ['Basics', 'Circles', 'Figures'] as const;
  return (
    <Dialog title="Problems" size="wide" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Classic constructions from Euclid’s <em>Elements</em>. Your solution is checked automatically after every step, by moving the givens around to make sure it
        works in general, not just by eye.
      </p>
      {groups.map((g) => (
        <div key={g}>
          <div className="group-title">{g}</div>
          <div className="problem-grid">
            {PROBLEMS.filter((p) => p.group === g).map((p) => {
              const pr = progress[p.id];
              return (
                <button key={p.id} className="problem-card" data-problem={p.id} onClick={() => void openProblem(p)}>
                  <span className="t">{p.title}</span>
                  <span className="s">{p.statement}</span>
                  {pr?.solved && <span className="solved">Solved ✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Dialog>
  );
}

function AccountDialog({ onClose }: { onClose: () => void }) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    void currentUser().then(setUser);
    let off = () => {};
    void onAuthChange(setUser).then((f) => (off = f));
    return () => off();
  }, []);
  return (
    <Dialog title="Account & sync" size="small" onClose={onClose}>
      {user ? (
        <>
          <p>
            Signed in as <strong>{user.email}</strong>. Your constructions sync to your account as you work.
          </p>
          <button className="secondary-btn" onClick={() => void signOut().then(() => setUser(null))}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="muted">Sign in to keep your constructions and progress on every device. Without an account everything stays in this browser.</p>
          <button className="primary-btn" style={{ width: '100%' }} onClick={() => signInWithGoogle().catch((e) => toast(e.message, 'error'))}>
            Continue with Google
          </button>
          <div className="group-title">or get a sign-in link by email</div>
          {sent ? (
            <p>Check your inbox for the sign-in link.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                signInWithEmail(email)
                  .then(() => setSent(true))
                  .catch((err) => toast(err.message, 'error'));
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input className="text-input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
              <button className="secondary-btn">Send</button>
            </form>
          )}
        </>
      )}
    </Dialog>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About DrawGeo" onClose={onClose}>
      <p>
        A ruler-and-compass construction workspace: Euclidea’s clean feel and scoring, GeoGebra Geometry’s tools behind <strong>More</strong>, and a recorded list of
        steps so you can see how you solved it.
      </p>
      <p>
        <strong>Points.</strong> Filled points can be dragged; hollow ones are constructed (intersections, midpoints…) and follow along.
      </p>
      <p className="muted">Works offline once loaded. Constructions are saved in this browser.</p>
    </Dialog>
  );
}
