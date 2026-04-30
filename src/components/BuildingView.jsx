import { useRef, useEffect } from 'react';
import { initBabylon, buildBuilding, resetCamera } from '../lib/babylonViewer';

export default function BuildingView({ floors }) {
  const canvasRef  = useRef(null);
  const babylonRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = initBabylon(canvasRef.current);
    babylonRef.current = ctx;

    const onResize = () => ctx.engine.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      ctx.engine.stopRenderLoop();
      ctx.engine.dispose();
      babylonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!babylonRef.current) return;
    buildBuilding(floors, babylonRef.current.shadowGen);
  }, [floors]);

  const floorsWithWalls = floors.filter(f => f.walls.length > 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-2.5 bg-zinc-900 border-b border-zinc-800/80 flex-shrink-0">
        <span className="text-[11px] text-zinc-500">
          {floorsWithWalls.length
            ? `${floorsWithWalls.length} of ${floors.length} floor${floors.length !== 1 ? 's' : ''} rendered`
            : 'No floors detected yet'}
        </span>
        <button
          onClick={resetCamera}
          className="ml-auto px-3.5 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-stone-300 rounded-lg border border-zinc-700/60 transition-colors duration-150"
        >
          Reset Camera
        </button>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 bg-zinc-950">
        <canvas ref={canvasRef} className="w-full h-full block outline-none touch-none" />
        {floorsWithWalls.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-sm text-zinc-600 text-center max-w-xs leading-relaxed">
              Detect walls on at least one floor plan,<br />then see your building here in 3D.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

