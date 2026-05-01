import { useRef, useEffect, useState, useCallback } from 'react';
import { initBabylon, buildBuilding, resetCamera, highlightFloor, setExplodeGap } from '../lib/babylonViewer';

export default function BuildingView({ floors, activeId }) {
  const canvasRef  = useRef(null);
  const babylonRef = useRef(null);
  const [exploded, setExploded] = useState(false);

  // Init Babylon once
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

  // Rebuild when floors change, then re-apply current highlight
  useEffect(() => {
    if (!babylonRef.current) return;
    buildBuilding(floors, babylonRef.current.shadowGen);
    highlightFloor(activeId);
    // Reset explode state on rebuild
    setExploded(false);
  }, [floors]);

  // Highlight when active floor changes
  useEffect(() => {
    highlightFloor(activeId);
  }, [activeId]);

  // Toggle explode gap
  const handleExplode = useCallback(() => {
    setExploded(prev => {
      const next = !prev;
      setExplodeGap(next);
      return next;
    });
  }, []);

  const floorsWithWalls = floors.filter(f => f.walls.length > 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Toolbar — z-10 + relative keeps it above the canvas at all times */}
      <div className="relative z-10 flex items-center gap-3 px-5 py-2.5 bg-zinc-900 border-b border-zinc-800/80 flex-shrink-0">
        <span className="text-[11px] text-zinc-500">
          {floorsWithWalls.length
            ? `${floorsWithWalls.length} of ${floors.length} floor${floors.length !== 1 ? 's' : ''} rendered`
            : 'No floors detected yet'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Explode button */}
          <button
            onClick={handleExplode}
            disabled={floorsWithWalls.length < 2}
            title={exploded ? 'Collapse floors' : 'Explode floors apart'}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150
              ${floorsWithWalls.length < 2
                ? 'opacity-30 cursor-not-allowed bg-zinc-800 border-zinc-700/60 text-stone-400'
                : exploded
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700/60 text-stone-300'
              }`}
          >
            {/* Explode icon: stacked layers with gap arrows */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              {exploded ? (
                /* collapse: layers moving together */
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 9l7-5 7 5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7 5 7-5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                </>
              ) : (
                /* explode: layers spreading apart */
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 6l7-3 7 3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l7-3 7 3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 18l7-3 7 3" />
                </>
              )}
            </svg>
            {exploded ? 'Collapse' : 'Explode'}
          </button>

          <button
            onClick={resetCamera}
            className="px-3.5 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-stone-300 rounded-lg border border-zinc-700/60 transition-colors duration-150"
          >
            Reset Camera
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 bg-zinc-950 overflow-hidden">
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
