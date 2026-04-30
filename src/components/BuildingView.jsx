import { useRef, useEffect, useState } from 'react';
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

  // Rebuild whole building whenever floors change
  useEffect(() => {
    if (!babylonRef.current) return;
    buildBuilding(floors, babylonRef.current.shadowGen);
  }, [floors]);

  const floorsWithWalls = floors.filter(f => f.walls.length > 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <span className="text-xs text-slate-400">
          {floorsWithWalls.length} / {floors.length} floors with detected walls
        </span>
        <button
          onClick={resetCamera}
          className="ml-auto px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md border border-slate-600"
        >
          🎥 Reset Camera
        </button>
      </div>

      {/* Canvas */}
      <div className="relative flex-1">
        <canvas ref={canvasRef} className="w-full h-full block outline-none touch-none" />
        {floorsWithWalls.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-slate-700 text-sm pointer-events-none text-center px-12">
            Detect walls on at least one floor, then switch here to see the 3D building.
          </p>
        )}
      </div>
    </div>
  );
}
