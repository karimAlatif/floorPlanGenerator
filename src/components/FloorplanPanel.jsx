import { useRef, useEffect, useCallback } from 'react';

// ── Reusable slider control ────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, onChange, unit = '', accent = 'sky' }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[100px]">
      <span className="text-[11px] text-slate-400 whitespace-nowrap">
        {label}:{' '}
        <span className="text-slate-100 font-medium">{value}</span>
        {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-24 accent-${accent}-500 cursor-pointer h-1`}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function FloorplanPanel({
  originalImage,
  cleanedBitmap,
  walls,
  points,
  showingCleaned,
  isDetecting,
  darkThreshold,
  minLen,
  minComponentArea,
  onImageLoad,
  onDetect,
  onToggleCleaned,
  onExport,
  onDarkThresholdChange,
  onMinLenChange,
  onMinComponentAreaChange,
}) {
  const fileInputRef    = useRef(null);
  const imageCanvasRef  = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef    = useRef(null);
  const imgTransformRef = useRef(null); // { dx, dy, scale }

  // Draw an image or ImageBitmap source onto the canvas
  const drawToCanvas = useCallback((source) => {
    const canvas   = imageCanvasRef.current;
    const overlay  = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !source) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const sw = source.width;
    const sh = source.height;
    if (!cw || !ch || !sw || !sh) return;

    const scale = Math.min(cw / sw, ch / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    for (const c of [canvas, overlay]) {
      c.width  = cw;
      c.height = ch;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = !(source instanceof ImageBitmap);
    ctx.drawImage(source, dx, dy, dw, dh);

    imgTransformRef.current = { dx, dy, scale };
  }, []);

  // Draw cyan wall lines + pink corner dots on the overlay canvas
  const drawOverlay = useCallback((wls, pts) => {
    const canvas = overlayCanvasRef.current;
    const t = imgTransformRef.current;
    if (!canvas || !t) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!wls?.length) return;

    const cx = (ix) => t.dx + ix * t.scale;
    const cy = (iy) => t.dy + iy * t.scale;

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.8;
    for (const w of wls) {
      ctx.beginPath();
      ctx.moveTo(cx(w.x1), cy(w.y1));
      ctx.lineTo(cx(w.x2), cy(w.y2));
      ctx.stroke();
    }

    ctx.fillStyle   = '#ff4081';
    ctx.globalAlpha = 0.9;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(cx(p.x), cy(p.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, []);

  // Re-draw whenever image/view/walls change
  useEffect(() => {
    const source = showingCleaned && cleanedBitmap ? cleanedBitmap : originalImage;
    drawToCanvas(source);
    drawOverlay(walls, points);
  }, [originalImage, cleanedBitmap, showingCleaned, walls, points, drawToCanvas, drawOverlay]);

  // ResizeObserver keeps the canvas sharp when the panel resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const source = showingCleaned && cleanedBitmap ? cleanedBitmap : originalImage;
      drawToCanvas(source);
      drawOverlay(walls, points);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [originalImage, cleanedBitmap, showingCleaned, walls, points, drawToCanvas, drawOverlay]);

  // File picker handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { onImageLoad(img); URL.revokeObjectURL(url); };
    img.src = url;
    e.target.value = ''; // allow re-picking the same file
  };

  const hasImage   = !!originalImage;
  const hasResults = walls.length > 0;

  return (
    <div className="w-1/2 flex flex-col border-r border-slate-800">

      {/* ── Toolbar ── */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <h2 className="text-sky-400 text-sm font-semibold tracking-wide mb-3">
          🗺 Floorplan Wall Detector
        </h2>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Load image button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200
                       rounded-md border border-slate-600 transition-colors duration-150"
          >
            📂 Load Image
          </button>

          {/* Detection sliders */}
          <Slider
            label="Wall Darkness"
            value={darkThreshold}
            min={10} max={120}
            onChange={onDarkThresholdChange}
            accent="sky"
          />
          <Slider
            label="Min Wall px"
            value={minLen}
            min={5} max={500}
            onChange={onMinLenChange}
            accent="sky"
          />
          <Slider
            label="Remove Furn. <"
            value={minComponentArea}
            min={50} max={5000} step={50}
            unit=" px"
            onChange={onMinComponentAreaChange}
            accent="sky"
          />

          {/* Action buttons */}
          <button
            onClick={onDetect}
            disabled={!hasImage || isDetecting}
            className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-white rounded-md transition-colors duration-150"
          >
            {isDetecting ? '⏳ Detecting…' : '🔍 Detect Walls'}
          </button>

          <button
            onClick={onToggleCleaned}
            disabled={!cleanedBitmap}
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-slate-200 rounded-md border border-slate-600 transition-colors duration-150"
          >
            {showingCleaned ? '🖼 Show Original' : '👁 Show Cleaned'}
          </button>

          <button
            onClick={onExport}
            disabled={!hasResults}
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-slate-200 rounded-md border border-slate-600 transition-colors duration-150"
          >
            📤 Export JSON
          </button>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center"
      >
        <canvas ref={imageCanvasRef}  className="absolute top-0 left-0" />
        <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 pointer-events-none" />
        {!hasImage && (
          <p className="text-slate-600 text-sm select-none pointer-events-none">
            Load a floorplan image to begin
          </p>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="bg-slate-900 px-4 py-1.5 border-t border-slate-800 flex gap-5 text-[11px] text-slate-500 flex-shrink-0">
        <span>Walls: <span className="text-slate-300">{walls.length}</span></span>
        <span>Points: <span className="text-slate-300">{points.length}</span></span>
        {originalImage && (
          <span>
            Size: <span className="text-slate-300">{originalImage.width} × {originalImage.height}</span>
          </span>
        )}
      </div>
    </div>
  );
}
