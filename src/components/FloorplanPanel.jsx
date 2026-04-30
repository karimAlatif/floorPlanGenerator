import { useEffect, useMemo, useRef, useCallback } from 'react';

function Slider({ label, value, min, max, step = 1, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-300 min-w-[140px]">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-sky-300">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-sky-500"
      />
    </label>
  );
}

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
  const fileInputRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const imgTransformRef = useRef({ dx: 0, dy: 0, scale: 1 });

  const sourceImage = useMemo(() => {
    if (showingCleaned && cleanedBitmap) return cleanedBitmap;
    return originalImage;
  }, [showingCleaned, cleanedBitmap, originalImage]);

  const drawToCanvas = useCallback((source) => {
    const container = containerRef.current;
    const imageCanvas = imageCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !imageCanvas || !overlayCanvas) return;

    const cw = Math.max(1, container.clientWidth);
    const ch = Math.max(1, container.clientHeight);

    imageCanvas.width = cw;
    imageCanvas.height = ch;
    overlayCanvas.width = cw;
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
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, dx, dy, dw, dh);
  }, []);

  const drawOverlay = useCallback((wls, pts) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    const { dx, dy, scale } = imgTransformRef.current;

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!wls.length) return;

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const w of wls) {
      ctx.moveTo(dx + w.x1 * scale, dy + w.y1 * scale);
      ctx.lineTo(dx + w.x2 * scale, dy + w.y2 * scale);
    }
    ctx.stroke();

    if (pts.length) {
      ctx.fillStyle = '#f472b6';
      for (const p of pts) {
        const x = dx + p.x * scale;
        const y = dy + p.y * scale;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  useEffect(() => {
    drawToCanvas(sourceImage);
    drawOverlay(walls, points);
  }, [sourceImage, walls, points, drawToCanvas, drawOverlay]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      drawToCanvas(sourceImage);
      drawOverlay(walls, points);
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [sourceImage, walls, points, drawToCanvas, drawOverlay]);

  const triggerFileSelect = () => fileInputRef.current?.click();

  const onChooseFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => onImageLoad(img);
    img.onerror = () => alert('Failed to load image');
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="w-1/2 border-r border-slate-800 flex flex-col min-w-[460px]">
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <button
            onClick={triggerFileSelect}
            className="px-3 py-1.5 text-xs rounded-md bg-sky-600 hover:bg-sky-500 text-white"
          >
            Load Image
          </button>
          <button
            onClick={onDetect}
            disabled={!originalImage || isDetecting}
            className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {isDetecting ? 'Detecting...' : 'Detect Walls'}
          </button>
          <button
            onClick={onToggleCleaned}
            disabled={!cleanedBitmap}
            className="px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-50"
          >
            {showingCleaned ? 'Show Original' : 'Show Cleaned'}
          </button>
          <button
            onClick={onExport}
            disabled={!walls.length}
            className="px-3 py-1.5 text-xs rounded-md bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-50"
          >
            Export JSON
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onChooseFile}
            className="hidden"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Slider
            label="Wall Darkness"
            value={darkThreshold}
            min={10}
            max={120}
            onChange={onDarkThresholdChange}
          />
          <Slider
            label="Min Wall px"
            value={minLen}
            min={5}
            max={500}
            onChange={onMinLenChange}
          />
          <Slider
            label="Remove Furn. <"
            value={minComponentArea}
            min={50}
            max={5000}
            onChange={onMinComponentAreaChange}
          />
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 bg-slate-950 overflow-hidden">
        <canvas ref={imageCanvasRef} className="absolute top-0 left-0" />
        <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 pointer-events-none" />
      </div>

      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
        <span>Walls: {walls.length}</span>
        <span>Points: {points.length}</span>
        <span>{sourceImage ? `${sourceImage.width} x ${sourceImage.height}` : 'No image loaded'}</span>
      </div>
    </div>
  );
}
