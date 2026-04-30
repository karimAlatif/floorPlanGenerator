import { useRef, useState } from 'react';

// ── Floor card ────────────────────────────────────────────────────────────────
function FloorCard({ floor, isActive, index, onSelect, onRename, onDelete, onDuplicate, onDragStart, onDragOver, onDrop }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(floor.name);
  const inputRef = useRef(null);

  const commitRename = () => {
    setEditing(false);
    const name = draftName.trim() || floor.name;
    setDraftName(name);
    onRename(floor.id, name);
  };

  const startEdit = (e) => {
    e.stopPropagation();
    setDraftName(floor.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 10);
  };

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      onClick={() => onSelect(floor.id)}
      className={`group relative flex flex-col gap-2 p-2.5 rounded-xl cursor-pointer border transition-all duration-200
        ${isActive
          ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/20'
          : 'bg-zinc-800/50 border-zinc-700/40 hover:bg-zinc-800 hover:border-zinc-600/60'}`}
    >
      {/* Thumbnail */}
      <div className="w-full aspect-video bg-zinc-950 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-700/30">
        {floor.image ? (
          <CanvasThumbnail image={floor.image} walls={floor.walls} />
        ) : (
          <span className="text-zinc-600 text-[10px]">No image</span>
        )}
      </div>

      {/* Name */}
      <div className="flex items-center min-w-0 px-0.5" onClick={e => e.stopPropagation()}>
        {editing ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            className="flex-1 min-w-0 text-xs bg-zinc-700 border border-amber-500/70 rounded-md px-2 py-0.5 text-stone-100 outline-none"
          />
        ) : (
          <span
            className={`flex-1 min-w-0 text-[11px] font-medium truncate transition-colors ${isActive ? 'text-amber-300' : 'text-stone-300'}`}
            onDoubleClick={startEdit}
            title={floor.name + ' (double-click to rename)'}
          >
            {floor.name}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] text-zinc-500">
          {floor.walls.length ? `${floor.walls.length} walls` : 'undetected'}
        </span>
        {floor.isDetecting && (
          <span className="text-[10px] text-amber-400 animate-pulse">scanning…</span>
        )}
      </div>

      {/* Hover action bar */}
      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
        {[
          { icon: '✏', title: 'Rename',    action: (e) => startEdit(e),                     hov: 'hover:bg-zinc-600' },
          { icon: '⧉', title: 'Duplicate', action: (e) => { e.stopPropagation(); onDuplicate(floor.id); }, hov: 'hover:bg-zinc-600' },
          { icon: '✕', title: 'Delete',    action: (e) => { e.stopPropagation(); onDelete(floor.id); },    hov: 'hover:bg-red-600/80' },
        ].map(({ icon, title, action, hov }) => (
          <button
            key={title}
            onClick={action}
            title={title}
            className={`w-5 h-5 flex items-center justify-center rounded-md bg-zinc-700/90 ${hov} text-stone-300 text-[10px] transition-colors duration-150`}
          >{icon}</button>
        ))}
      </div>

      {/* Drag grip */}
      <div className="absolute bottom-2 right-2 text-zinc-600 text-[10px] select-none cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">⠿</div>
    </div>
  );
}

// ── Thumbnail canvas ──────────────────────────────────────────────────────────
function CanvasThumbnail({ image, walls }) {
  const draw = (canvas) => {
    if (!canvas || !image) return;
    const { width: w, height: h } = canvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const sc = Math.min(w / image.width, h / image.height);
    const dw = image.width * sc, dh = image.height * sc;
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.drawImage(image, dx, dy, dw, dh);

    if (walls.length) {
      ctx.strokeStyle = '#f59e0b88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const wall of walls) {
        ctx.moveTo(dx + wall.x1 * sc, dy + wall.y1 * sc);
        ctx.lineTo(dx + wall.x2 * sc, dy + wall.y2 * sc);
      }
      ctx.stroke();
    }
  };

  return (
    <canvas
      ref={el => draw(el)}
      width={160}
      height={90}
      className="w-full h-full"
    />
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({ onUpload }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); onUpload(e.dataTransfer.files); }}
      className={`flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
        ${dragging
          ? 'border-amber-400 bg-amber-500/10 scale-[1.02]'
          : 'border-zinc-700 bg-zinc-800/20 hover:border-zinc-500 hover:bg-zinc-800/40'}`}
    >
      <div className="w-8 h-8 rounded-lg bg-zinc-700/60 flex items-center justify-center text-stone-400 text-sm">+</div>
      <span className="text-[11px] text-zinc-500 text-center leading-snug">
        Add floor plans
      </span>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={e => onUpload(e.target.files)} className="hidden" />
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function FloorSidebar({ floors, activeId, onSelect, onUpload, onRename, onDelete, onDuplicate, onReorder }) {
  const dragFromRef = useRef(null);

  return (
    <aside className="w-56 flex-shrink-0 bg-zinc-900 border-r border-zinc-800/80 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-4 rounded-full bg-amber-500" />
          <h1 className="text-xs font-semibold text-stone-300 tracking-widest uppercase">Floors</h1>
        </div>
        <UploadZone onUpload={onUpload} />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 scrollbar-thin">
        {floors.length === 0 ? (
          <p className="text-center text-[11px] text-zinc-600 pt-8 leading-relaxed">
            No floors yet.<br />Add a floor plan above.
          </p>
        ) : (
          floors.map((floor, idx) => (
            <FloorCard
              key={floor.id}
              floor={floor}
              index={idx}
              isActive={floor.id === activeId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onDragStart={(i) => { dragFromRef.current = i; }}
              onDragOver={() => {}}
              onDrop={(toIdx) => {
                const from = dragFromRef.current;
                if (from != null && from !== toIdx) onReorder(from, toIdx);
                dragFromRef.current = null;
              }}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {floors.length > 0 && (
        <div className="px-4 py-2.5 border-t border-zinc-800/80 text-[10px] text-zinc-600 flex justify-between">
          <span>{floors.length} floor{floors.length !== 1 ? 's' : ''}</span>
          <span>drag to reorder</span>
        </div>
      )}
    </aside>
  );
}

