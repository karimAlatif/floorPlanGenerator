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

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const w of walls) {
      ctx.moveTo(dx + w.x1 * scale, dy + w.y1 * scale);
      ctx.lineTo(dx + w.x2 * scale, dy + w.y2 * scale);
    }
    ctx.stroke();

    if (points.length) {
      ctx.fillStyle = '#fb923c';
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
    <div ref={containerRef} className="relative flex-1 min-w-0 min-h-0 bg-zinc-950 overflow-hidden">
      <canvas ref={imageCanvasRef}  className="absolute top-0 left-0" />
      <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 pointer-events-none" />
      {!floor.image && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-700 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span className="text-sm">Select a floor from the left panel</span>
        </div>
      )}
    </div>
  );
}
