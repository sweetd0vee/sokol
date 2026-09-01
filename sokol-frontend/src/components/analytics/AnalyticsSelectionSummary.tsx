import { X } from 'lucide-react';

export type AnalyticsSelectionSummaryChip = {
  value: string;
  label: string;
};

export type AnalyticsSelectionSummaryItem = {
  label: string;
  chips: AnalyticsSelectionSummaryChip[];
  emptyLabel?: string;
  onRemove?: (value: string) => void;
};

export type AnalyticsSelectionSummaryMetric = {
  label: string;
  value: number | string;
  hint?: string;
};

type AnalyticsSelectionSummaryProps = {
  metrics: AnalyticsSelectionSummaryMetric[];
  items: AnalyticsSelectionSummaryItem[];
};

function formatMetricValue(metric: AnalyticsSelectionSummaryMetric) {
  if (!metric.hint) {
    return metric.value;
  }

  const total = metric.hint.replace(/^из\s+/i, '').trim();
  return`${metric.value}/${total}`;
}

export function AnalyticsSelectionSummary({
  metrics,
  items,
}: AnalyticsSelectionSummaryProps) {
  return (
    <section className="rounded-lg bg-gray-100 p-3.5 text-left">
      <h3 className="mb-3 text-base font-semibold text-gray-900">Выбрано</h3>

      <div className="mb-3 space-y-1.5">
        {metrics.map((metric) => (
          <p key={metric.label} className="text-sm font-semibold text-gray-900">
            <span>{metric.label}:</span>{' '}
            <span>{formatMetricValue(metric)}</span>
          </p>
        ))}
      </div>

      <div className="space-y-2.5">
        {items.map((item) => {
          return (
            <div key={item.label}>
              <p className="mb-2 text-sm font-medium leading-relaxed text-gray-900">
                {item.label}
              </p>
              {item.chips.length === 0 ? (
                <span className="inline-flex rounded-md bg-white/70 px-2 py-1 text-[11px] text-gray-500">
                  {item.emptyLabel ?? 'Все'}
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {item.chips.map((chip) =>
                    item.onRemove ? (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => item.onRemove?.(chip.value)}
                        title={`Убрать «${chip.label}»`}
                        aria-label={`Убрать ${chip.label}`}
                        className="group inline-flex max-w-full items-center gap-1 rounded-md bg-[rgb(197,216,255)] py-1 pl-2.5 pr-1 text-xs font-medium text-gray-900 transition hover:bg-[rgb(168,196,252)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sber-dark/30"
                      >
                        <span className="truncate">{chip.label}</span>
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-600 transition group-hover:bg-white/70 group-hover:text-gray-900">
                          <X className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                      </button>
                    ) : (
                      <span
                        key={chip.value}
                        className="max-w-full truncate rounded-md bg-[rgb(197,216,255)] px-2 py-1 text-xs font-medium text-gray-900"
                        title={chip.label}
                      >
                        {chip.label}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
