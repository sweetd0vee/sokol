import { useEffect, useRef } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { registerDashboardChart } from '../../../utils/dashboardChartRegistry';
import { ConstructorChartBody } from './ConstructorChartBody';
import { CONSTRUCTOR_SOURCE_LABELS, type ConstructorWidget } from './constructorTypes';

const SOURCE_BADGE: Record<ConstructorWidget['kind'], string> = {
  checks: 'bg-blue-50 text-blue-800',
  recommendations: 'bg-rose-50 text-rose-800',
  monitoring: 'bg-amber-50 text-amber-900',
  dva: 'bg-indigo-50 text-indigo-800',
};

export function ConstructorWidgetCard({
  widget,
  onRemove,
}: {
  widget: ConstructorWidget;
  onRemove: (instanceId: string) => void;
}) {
  const captureRef = useRef<HTMLElement>(null);
  const isKpi = widget.payload.chart === 'kpi';

  useEffect(() => {
    return registerDashboardChart({
      id: widget.instanceId,
      title: widget.title,
      description: widget.filterCaption,
      getNode: () => captureRef.current,
    });
  }, [widget.filterCaption, widget.instanceId, widget.title]);

  return (
    <section
      ref={captureRef}
      data-analytics-export-capture-id={widget.instanceId}
      data-analytics-export-title={widget.title}
      data-analytics-export-description={widget.filterCaption}
      className="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm"
    >
      <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="constructor-drag-handle inline-flex h-6 w-6 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-gray-50 hover:text-gray-700 active:cursor-grabbing"
              aria-label="Перетащить"
              title="Перетащить"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <h3 className="truncate text-sm font-semibold leading-snug text-sber-dark">{widget.title}</h3>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_BADGE[widget.kind]}`}>
              {CONSTRUCTOR_SOURCE_LABELS[widget.kind]}
            </span>
          </div>
          {widget.description ? (
            <p className="ml-7 truncate text-xs leading-snug text-gray-500">{widget.description}</p>
          ) : null}
          <p className="ml-7 truncate text-[11px] leading-snug text-gray-400" title={widget.filterCaption}>
            {widget.filterCaption}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(widget.instanceId)}
          className="constructor-widget-actions inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-rose-300 hover:text-rose-700"
          title="Удалить с дашборда"
          aria-label="Удалить с дашборда"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className={
          isKpi
            ? 'min-w-0'
            : 'min-h-0 min-w-0 flex-1 lg:[&>*]:!h-full lg:[&_.recharts-responsive-container]:!h-full'
        }
      >
        <ConstructorChartBody payload={widget.payload} />
      </div>
    </section>
  );
}
