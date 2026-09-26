import { useEffect, useRef } from 'react';
import { controller } from '../controller';

export function CanvasView() {
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    controller.attach(wrap.current!, scene.current!, overlay.current!);
    return () => controller.detach();
  }, []);
  return (
    <div className="canvas-wrap" ref={wrap} data-testid="canvas">
      <canvas ref={scene} />
      <canvas ref={overlay} />
    </div>
  );
}
