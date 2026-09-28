import { movedIds, restoreMoved, useApp } from '../store';
import { Icon } from './Icons';

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite" data-testid="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`panel toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Appears only while points moved with the Move tool are away from where they started. */
export function RestoreButton() {
  const moved = useApp((s) => movedIds(s).length > 0);
  if (!moved) return null;
  return (
    <button className="icon-btn restore-btn" aria-label="Put moved points back" title="Put moved points back" data-testid="restore-moved" onClick={restoreMoved}>
      <Icon name="restorePoints" />
    </button>
  );
}
