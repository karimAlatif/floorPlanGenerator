import { useRef, useEffect, useState } from 'react';
import { initBabylon, buildWalls, resetCamera } from '../lib/babylonViewer';

// ── Reusable slider control ────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, onChange, unit = '' }) {
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
        className="w-24 accent-emerald-500 cursor-pointer h-1"
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function BabylonPanel({
  walls,
  imgWidth,
  imgHeight,
  wallHeight,
  wallThickness,
  onWallHeightChange,
  onWallThicknessChange,
}) {
  const canvasRef    = useRef(null);
  const babylonRef   = useRef(null);   // { engine, scene, shadowGen }
  const [hasWalls, setHasWalls] = useState(false);

  // Init BabylonJS engine once on mount
  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = initBabylon(canvasRef.current);
    babylonRef.current = ctx;

    // Handle window resize
    const onResize = () => ctx.engine.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      ctx.engine.stopRenderLoop();
      ctx.engine.dispose();
      babylonRef.current = null;
    };
  }, []);

  // Rebuild walls whenever walls or 3D settings change
  useEffect(() => {
    if (!walls.length || !babylonRef.current) return;

    buildWalls(walls, imgWidth, imgHeight, {
      wallHeight,
      wallThickness,
      shadowGen: babylonRef.current.shadowGen,
    });
    setHasWalls(true);
  }, [walls, imgWidth, imgHeight, wallHeight, wallThickness]);

  return (
    <div className="w-1/2 flex flex-col">

      {/* ── Panel header ── */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <h2 className="text-emerald-400 text-sm font-semibold tracking-wide mb-3">
          🏠 3D Preview (BabylonJS)
        </h2>

        <div className="flex flex-wrap gap-3 items-end">
          <Slider
            label="Wall Height"
            value={wallHeight}
            min={1} max={10} step={0.5}
            unit="m"
            onChange={onWallHeightChange}
          />
          <Slider
            label="Wall Thickness"
            value={wallThickness}
            min={0.05} max={1} step={0.05}
            unit="m"
            onChange={onWallThicknessChange}
          />

          <button
            onClick={resetCamera}
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600
                       text-slate-200 rounded-md border border-slate-600 transition-colors duration-150"
          >
            🎥 Reset Camera
          </button>
        </div>
      </div>

      {/* ── BabylonJS canvas ── */}
      <div className="relative flex-1 bg-slate-950">
        <canvas
          ref={canvasRef}
          className="w-full h-full block outline-none touch-none"
        />
        {!hasWalls && (
          <p className="absolute inset-0 flex items-center justify-center
                        text-slate-700 text-sm pointer-events-none text-center px-8">
            Detect walls first — they will appear here in 3D
          </p>
        )}
      </div>
    </div>
  );
}
