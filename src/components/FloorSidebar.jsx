import { useRef, useState } from 'react';

// Drag-to-sort floor card
function FloorCard({ floor, isActive, index, total, onSelect, onRename, onDelete, onDuplicate, onDragStart, onDragOver, onDrop }) {
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
      className={`group relative flex flex-col gap-1 p-2 rounded-lg cursor-pointer border transition-all duration-150
        ${isActive
          ? 'bg-sky-900/60 border-sky-500/70 shadow-lg shadow-sky-900/30'
          : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'}`}
    >
      {/* Thumbnail */}
      <div className="w-full aspect-video bg-slate-900 rounded overflow-hidden flex items-center justify-center">
        {floor.image ? (
          <CanvasThumbnail image={floor.image} walls={floor.walls} />
        ) : (
          <span className="text-slate-600 text-xs">No image</span>
        )}
      </div>

      {/* Name row */}
      <div className="flex items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
        {editing ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            className="flex-1 min-w-0 text-xs bg-slate-700 border border-sky-500 rounded px-1.5 py-0.5 text-slate-100 outline-none"
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-xs text-slate-200 truncate"
            onDoubleClick={startEdit}
            title={floor.name + ' (double-click to rename)'}
          >
            {floor.name}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-2 text-[10px] text-slate-500">
        <span>{floor.walls.length} walls</span>
        {floor.isDetecting && <span className="text-sky-400 animate-pulse">detecting…</span>}
      </div>

      {/* Action buttons — show on hover */}
      <div className="absolute top-1.5 right-1.5 hidden group-hover:flex gap-1">
        <button
          onClick={e => { e.stopPropagation(); startEdit(e); }}
          title="Rename"
          className="p-1 rounded bg-slate-700/90 hover:bg-slate-600 text-slate-300 text-[11px] leading-none"
        >✏️</button>
        <button
          onClick={e => { e.stopPropagation(); onDuplicate(floor.id); }}
          title="Duplicate"
          className="p-1 rounded bg-slate-700/90 hover:bg-slate-600 text-slate-300 text-[11px] leading-none"
        >⧉</button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(floor.id); }}
          title="Delete"
          className="p-1 rounded bg-slate-700/90 hover:bg-red-600 text-slate-300 text-[11px] leading-none"
        >✕</button>
      </div>

      {/* Drag handle badge */}
      <div className="absolute bottom-1.5 right-1.5 text-slate-600 text-[10px] select-none cursor-grab">⠿</div>
    </div>
  );
}

// Small canvas thumbnail with wall overlay
function CanvasThumbnail({ image, walls }) {
  const canvasRef = useRef(null);

  // Draw once image changes
  const draw = (canvas) => {
    if (!canvas || !image) return;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const scale = Math.min(w / image.width, h / image.height);
    const dw = image.width * scale, dh = image.height * scale;
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.drawImage(image, dx, dy, dw, dh);

    if (walls.length) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const wall of walls) {
        ctx.moveTo(dx + wall.x1 * scale, dy + wall.y1 * scale);
        ctx.lineTo(dx + wall.x2 * scale, dy + wall.y2 * scale);
      }
      ctx.stroke();
    }
  };

  return (
    <canvas
      ref={el => { canvasRef.current = el; draw(el); }}
      width={160}
      height={90}
      className="w-full h-full object-contain"
    />
  );
}

// Drop zone for file upload
function UploadZone({ onUpload }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => onUpload(files);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors duration-150
        ${dragging ? 'border-sky-400 bg-sky-900/20' : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'}`}
    >
      <span className="text-2xl">📂</span>
      <span className="text-xs text-slate-400 text-center leading-tight">
        Click or drop<br/>floorplan images
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={e => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}

export default function FloorSidebar({ floors, activeId, onSelect, onUpload, onRename, onDelete, onDuplicate, onReorder }) {
  const dragFromRef = useRef(null);

  const handleDragStart = (idx) => { dragFromRef.current = idx; };
  const handleDragOver  = (idx) => { /* visual feedback could go here */ };
  const handleDrop      = (toIdx) => {
    const fromIdx = dragFromRef.current;
    if (fromIdx != null && fromIdx !== toIdx) {
      onReorder(fromIdx, toIdx);
    }
    dragFromRef.current = null;
  };

  return (
    <aside className="w-52 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-800">
        <h1 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-2">Floors</h1>
        <UploadZone onUpload={onUpload} />
      </div>

      {/* Floor list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {floors.length === 0 && (
          <p className="text-center text-xs text-slate-600 pt-6">No floors yet</p>
        )}
        {floors.map((floor, idx) => (
          <FloorCard
            key={floor.id}
            floor={floor}
            index={idx}
            total={floors.length}
            isActive={floor.id === activeId}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Footer */}
      {floors.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-800 text-[10px] text-slate-600">
          {floors.length} floor{floors.length !== 1 ? 's' : ''} · drag to reorder
        </div>
      )}
    </aside>
  );
}
