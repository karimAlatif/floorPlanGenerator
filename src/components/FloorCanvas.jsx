import { useEffect, useRef, useCallback, useMemo } from 'react';

export default function FloorCanvas({ floor }) {
  const imageCanvasRef  = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef    = useRef(null);
  const imgTransformRef = useRef({ dx: 0, dy: 0, scale: 1 });

  const sourceImage = useMemo(() => {
    if (floor.showingCleaned && floor.cleanedBitmap) return floor.cleanedBitmap;
    return floor.image;
  }, [floor.showingCleaned, floor.cleanedBitmap, floor.image]);

  const drawToCanvas = useCallback((source) => {
    const container = containerRef.current;
    const imageCanvas = imageCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !imageCanvas || !overlayCanvas) return;

    const cw = Math.max(1, container.clientWidth);
    const ch = Math.max(1, container.clientHeight);

    imageCanvas.width  = cw;
    imageCanvas.height = ch;
    overlayCanvas.width  = cw;
    overlayCanvas.height = ch;

    const ctx = imageCanvas.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);

    if (!source) {
      imgTransformRef.current = { dx: 0, dy: 0, scale: 1 };
      return;
    }

    const scale = Math.min(cw / source.width, ch / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    imgTransformRef.current = { dx, dy, scale };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, dx, dy, dw, dh);
  }, []);

  const drawOverlay = useCallback((walls, points) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    const { dx, dy, scale } = imgTransformRef.current;

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!walls.length) return;

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const w of walls) {
      ctx.moveTo(dx + w.x1 * scale, dy + w.y1 * scale);
      ctx.lineTo(dx + w.x2 * scale, dy + w.y2 * scale);
    }
    ctx.stroke();

    if (points.length) {
      ctx.fillStyle = '#f472b6';
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(dx + p.x * scale, dy + p.y * scale, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  useEffect(() => {
    drawToCanvas(sourceImage);
    drawOverlay(floor.walls, floor.points);
  }, [sourceImage, floor.walls, floor.points, drawToCanvas, drawOverlay]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      drawToCanvas(sourceImage);
      drawOverlay(floor.walls, floor.points);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [sourceImage, floor.walls, floor.points, drawToCanvas, drawOverlay]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 bg-slate-950 overflow-hidden">
      <canvas ref={imageCanvasRef}  className="absolute top-0 left-0" />
      <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 pointer-events-none" />
      {!floor.image && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm pointer-events-none">
          Select a floor from the left panel
        </div>
      )}
    </div>
  );
}
