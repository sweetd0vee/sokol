export type AnalyticsSelectionSummaryItem = {
  label: string;
  values: string[];
  emptyLabel?: string;
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
  return `${metric.value}/${total}`;
}

export function AnalyticsSelectionSummary({
  metrics,
  items,
}: AnalyticsSelectionSummaryProps) {
  return (
    <section className="rounded-lg bg-gray-100 p-3.5 text-left dark:bg-slate-700">
      <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-sber-light">Выбрано</h3>

      <div className="mb-3 space-y-1.5">
        {metrics.map((metric) => (
          <p key={metric.label} className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            <span>{metric.label}:</span>{' '}
            <span>{formatMetricValue(metric)}</span>
          </p>
        ))}
      </div>

      <div className="space-y-2.5">
        {items.map((item) => {
          return (
            <div key={item.label}>
              <p className="mb-2 text-sm font-medium leading-relaxed text-gray-900 dark:text-slate-100">
                {item.label}
              </p>
              {item.values.length === 0 ? (
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-500 dark:bg-slate-700 dark:text-slate-300">
                  {item.emptyLabel ?? 'Все'}
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {item.values.map((value) => (
                    <span
                      key={value}
                      className="max-w-full truncate rounded-full bg-[rgb(197,216,255)] px-2 py-1 text-xs font-medium text-gray-900 dark:bg-[rgb(197,216,255)] dark:text-gray-900"
                      title={value}
                    >
                      {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
