export function CssBarPlotGrid({ ticks, max }: { ticks: number[]; max: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {ticks.map((tick) =>
        tick === 0 ? null : (
          <div
            key={tick}
            className="absolute inset-y-0 w-px bg-slate-200/70"
            style={{ left: `${(tick / max) * 100}%` }}
          />
        ),
      )}
    </div>
  );
}
