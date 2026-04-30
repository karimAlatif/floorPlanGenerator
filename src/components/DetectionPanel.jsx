function Slider({ label, value, min, max, step = 1, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-300">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-sky-300 font-mono">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-sky-500 cursor-pointer"
      />
    </label>
  );
}

function Btn({ onClick, disabled, variant = 'default', children }) {
  const base = 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed w-full text-center';
  const variants = {
    primary:   'bg-sky-600 hover:bg-sky-500 text-white',
    success:   'bg-emerald-600 hover:bg-emerald-500 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    danger:    'bg-fuchsia-700 hover:bg-fuchsia-600 text-white',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant] ?? variants.default}`}>
      {children}
    </button>
  );
}

export default function DetectionPanel({ floor, onDetect, onExport, onToggleCleaned, onChange }) {
  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
      <div className="px-3 py-3 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Detection</h2>
      </div>

      <div className="flex flex-col gap-4 p-3 flex-1">
        {/* Settings */}
        <div className="flex flex-col gap-3">
          <Slider
            label="Wall darkness"
            value={floor.darkThreshold}
            min={10} max={120}
            onChange={v => onChange({ darkThreshold: v })}
          />
          <Slider
            label="Min wall length (px)"
            value={floor.minLen}
            min={5} max={500}
            onChange={v => onChange({ minLen: v })}
          />
          <Slider
            label="Remove blobs <"
            value={floor.minComponentArea}
            min={50} max={5000} step={50}
            onChange={v => onChange({ minComponentArea: v })}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Btn
            variant="success"
            onClick={onDetect}
            disabled={!floor.image || floor.isDetecting}
          >
            {floor.isDetecting ? '⏳ Detecting…' : '🔍 Detect Walls'}
          </Btn>

          <Btn
            variant="secondary"
            onClick={onToggleCleaned}
            disabled={!floor.cleanedBitmap}
          >
            {floor.showingCleaned ? '🖼 Show Original' : '✨ Show Cleaned'}
          </Btn>

          <Btn
            variant="danger"
            onClick={onExport}
            disabled={!floor.walls.length}
          >
            📤 Export JSON
          </Btn>
        </div>

        {/* Stats */}
        {(floor.walls.length > 0 || floor.image) && (
          <div className="flex flex-col gap-1 rounded-lg bg-slate-800/60 px-3 py-2 text-[11px] text-slate-400">
            {floor.image && (
              <span>{floor.image.width} × {floor.image.height} px</span>
            )}
            {floor.walls.length > 0 && (
              <>
                <span>{floor.walls.length} walls detected</span>
                <span>{floor.points.length} corner points</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3D settings */}
      <div className="px-3 py-3 border-t border-slate-800 flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">3D Options</h2>
        <Slider
          label="Wall height (m)"
          value={floor.wallHeight}
          min={1} max={10} step={0.5}
          onChange={v => onChange({ wallHeight: v })}
        />
        <Slider
          label="Wall thickness (m)"
          value={floor.wallThickness}
          min={0.05} max={1} step={0.05}
          onChange={v => onChange({ wallThickness: v })}
        />
      </div>
    </aside>
  );
}
