// ── Reusable slider ─────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, onChange }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[11px]">
        <span className="text-stone-400">{label}</span>
        <span className="text-amber-400 font-mono font-medium">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-amber-500 cursor-pointer h-1 rounded-full"
      />
    </label>
  );
}

// ── Reusable button ──────────────────────────────────────────────────────────
function Btn({ onClick, disabled, variant = 'default', children }) {
  const base = 'flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed w-full';
  const variants = {
    primary:   'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-sm shadow-amber-900/40',
    secondary: 'bg-zinc-700/70 hover:bg-zinc-700 text-stone-300 border border-zinc-600/50',
    ghost:     'bg-transparent hover:bg-zinc-800 text-stone-400 hover:text-stone-200 border border-zinc-700/60',
    danger:    'bg-zinc-700/70 hover:bg-red-800/60 text-stone-300 hover:text-red-200 border border-zinc-600/50',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

// ── Section divider ──────────────────────────────────────────────────────────
function Section({ title, accent, children }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {accent && <div className="w-1 h-3 rounded-full bg-amber-500/70" />}
        <span className="text-[10px] font-semibold text-zinc-500 tracking-widest uppercase">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export default function DetectionPanel({ floor, onDetect, onExport, onToggleCleaned, onChange }) {
  return (
    <aside className="w-60 flex-shrink-0 bg-zinc-900 border-l border-zinc-800/80 flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-amber-500" />
          <h2 className="text-xs font-semibold text-stone-300 tracking-widest uppercase">Inspector</h2>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-5 p-4">

        {/* Detection params */}
        <Section title="Wall Detection" accent>
          <Slider label="Darkness threshold" value={floor.darkThreshold} min={10} max={120} onChange={v => onChange({ darkThreshold: v })} />
          <Slider label="Min wall length (px)" value={floor.minLen} min={5} max={500} onChange={v => onChange({ minLen: v })} />
          <Slider label="Ignore blobs smaller than" value={floor.minComponentArea} min={50} max={5000} step={50} onChange={v => onChange({ minComponentArea: v })} />
        </Section>

        {/* Action buttons */}
        <Section title="Actions">
          <Btn variant="primary" onClick={onDetect} disabled={!floor.image || floor.isDetecting}>
            {floor.isDetecting
              ? <><span className="animate-spin inline-block">⟳</span> Detecting…</>
              : <>Detect Walls</>}
          </Btn>
          <Btn variant="secondary" onClick={onToggleCleaned} disabled={!floor.cleanedBitmap}>
            {floor.showingCleaned ? 'Show Original' : 'Show Cleaned'}
          </Btn>
          <Btn variant="ghost" onClick={onExport} disabled={!floor.walls.length}>
            Export JSON
          </Btn>
        </Section>

        {/* Stats card */}
        {(floor.image || floor.walls.length > 0) && (
          <Section title="Info">
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/40 px-3.5 py-3 flex flex-col gap-1.5 text-[11px]">
              {floor.image && (
                <div className="flex justify-between text-zinc-400">
                  <span>Image size</span>
                  <span className="text-stone-300 font-mono">{floor.image.width}×{floor.image.height}</span>
                </div>
              )}
              {floor.walls.length > 0 && (
                <>
                  <div className="flex justify-between text-zinc-400">
                    <span>Walls</span>
                    <span className="text-amber-400 font-mono font-semibold">{floor.walls.length}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Corners</span>
                    <span className="text-stone-300 font-mono">{floor.points.length}</span>
                  </div>
                </>
              )}
            </div>
          </Section>
        )}

        {/* 3D options */}
        <Section title="3D Options" accent>
          <Slider label="Floor height (m)" value={floor.wallHeight} min={1} max={10} step={0.5} onChange={v => onChange({ wallHeight: v })} />
          <Slider label="Wall thickness (m)" value={floor.wallThickness} min={0.05} max={1} step={0.05} onChange={v => onChange({ wallThickness: v })} />
        </Section>

      </div>
    </aside>
  );
}

