import { useApp } from '../store';
import { controller } from '../controller';
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

export function ZoomControls() {
  const zoom = useApp((s) => s.zoom);
  return (
    <div className="panel zoom" role="group" aria-label="Zoom">
      <button aria-label="Zoom out" title="Zoom out (−)" onClick={() => controller.zoomBy(1 / 1.25)}>
        <Icon name="minus" size={18} />
      </button>
      <button className="pct" title="Zoom to fit (1)" aria-label="Zoom to fit" onClick={() => controller.zoomToFit()}>
        {Math.round(zoom * 100)}%
      </button>
      <button aria-label="Zoom in" title="Zoom in (+)" onClick={() => controller.zoomBy(1.25)}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}
