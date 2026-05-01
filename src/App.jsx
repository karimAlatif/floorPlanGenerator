import { useState, useCallback, useRef } from 'react';
import FloorSidebar from './components/FloorSidebar';
import FloorCanvas from './components/FloorCanvas';
import DetectionPanel from './components/DetectionPanel';
import BuildingView from './components/BuildingView';
import { detectWalls } from './lib/wallDetector';

let _nextId = 1;
function makeFloor(name, image) {
  return {
    id: _nextId++,
    name,
    image,          // HTMLImageElement
    cleanedBitmap: null,
    walls: [],
    points: [],
    showingCleaned: false,
    isDetecting: false,
    darkThreshold: 50,
    minLen: 20,
    minComponentArea: 500,
    wallHeight: 3,
    wallThickness: 0.2,
    floorIndex: 0,   // vertical position in 3D building (user-set via sort order)
  };
}

export default function App() {
  const [floors, setFloors]           = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [activeTab, setActiveTab]     = useState('2d'); // '2d' | '3d'

  // -- Helpers --
  const updateFloor = useCallback((id, patch) => {
    setFloors(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }, []);

  const activeFloor = floors.find(f => f.id === activeId) ?? null;

  // -- Upload --
  const handleUpload = useCallback((files) => {
    const images = Array.from(files).filter(f => f.type.startsWith('image/'));
    images.forEach(file => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const floor = makeFloor(file.name.replace(/\.[^.]+$/, ''), img);
        setFloors(prev => [...prev, floor]);
        setActiveId(floor.id);
        setActiveTab('2d');
      };
      img.src = url;
    });
  }, []);

  // -- Sidebar actions --
  const handleRename = useCallback((id, name) => updateFloor(id, { name }), [updateFloor]);

  const handleDelete = useCallback((id) => {
    setFloors(prev => {
      const next = prev.filter(f => f.id !== id);
      setActiveId(cur => {
        if (cur !== id) return cur;
        return next.length ? next[0].id : null;
      });
      return next;
    });
  }, []);

  const handleDuplicate = useCallback((id) => {
    setFloors(prev => {
      const src = prev.find(f => f.id === id);
      if (!src) return prev;
      const copy = { ...src, id: _nextId++, name: src.name + ' copy' };
      const idx = prev.findIndex(f => f.id === id);
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      setActiveId(copy.id);
      return next;
    });
  }, []);

  const handleReorder = useCallback((fromIdx, toIdx) => {
    setFloors(prev => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  }, []);

  // -- Detection --
  const handleDetect = useCallback(async (id) => {
    const floor = floors.find(f => f.id === id);
    if (!floor?.image) return;
    updateFloor(id, { isDetecting: true });

    try {
      await new Promise(r => setTimeout(r, 20));
      const oc = new OffscreenCanvas(floor.image.width, floor.image.height);
      const octx = oc.getContext('2d');
      octx.drawImage(floor.image, 0, 0);
      const imageData = octx.getImageData(0, 0, floor.image.width, floor.image.height);

      const result = detectWalls(imageData, {
        darkThreshold: floor.darkThreshold,
        minLength: floor.minLen,
        minComponentArea: floor.minComponentArea,
      });

      const imgData = new ImageData(new Uint8ClampedArray(result.cleanedData), result.width, result.height);
      const bitmap = await createImageBitmap(imgData);

      updateFloor(id, {
        walls: result.walls,
        points: result.points,
        cleanedBitmap: bitmap,
        isDetecting: false,
      });
    } catch (err) {
      console.error(err);
      alert('Detection failed: ' + err.message);
      updateFloor(id, { isDetecting: false });
    }
  }, [floors, updateFloor]);

  // -- Export --
  const handleExport = useCallback((id) => {
    const floor = floors.find(f => f.id === id);
    if (!floor?.walls.length) return;
    const data = {
      name: floor.name,
      imageSize: { width: floor.image.width, height: floor.image.height },
      walls: floor.walls,
      points: floor.points,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = floor.name + '_walls.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [floors]);

  return (
    <div className="flex h-screen bg-zinc-950 text-stone-200 overflow-hidden select-none">
      {/* ── Left sidebar: floor browser ── */}
      <FloorSidebar
        floors={floors}
        activeId={activeId}
        onSelect={setActiveId}
        onUpload={handleUpload}
        onRename={handleRename}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
      />

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Tab bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
          {[['2d', '2D Floorplan'], ['3d', '3D Building']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                activeTab === key
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-900/40'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-zinc-800'
              }`}
            >
              {label}
            </button>
          ))}
          {activeFloor && activeTab === '2d' && (
            <span className="ml-auto text-xs text-stone-500 truncate max-w-[200px] italic">
              {activeFloor.name}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {activeTab === '2d' ? (
            activeFloor ? (
              <>
                {/* 2D canvas */}
                <FloorCanvas
                  floor={activeFloor}
                />

                {/* Right detection panel */}
                <DetectionPanel
                  floor={activeFloor}
                  onDetect={() => handleDetect(activeFloor.id)}
                  onExport={() => handleExport(activeFloor.id)}
                  onToggleCleaned={() => updateFloor(activeFloor.id, { showingCleaned: !activeFloor.showingCleaned })}
                  onChange={(patch) => updateFloor(activeFloor.id, patch)}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10l9-7 9 7v11a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" /></svg>
                <p className="text-sm">Upload a floor plan from the left panel to get started.</p>
              </div>
            )
          ) : (
            <BuildingView floors={floors} activeId={activeId} />
          )}
        </div>
      </div>
    </div>
  );
}
