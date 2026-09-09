import { useEffect, useRef } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { registerDashboardChart } from '../../../utils/dashboardChartRegistry';
import { ConstructorChartBody } from './ConstructorChartBody';
import { isConstructorMatrixChart } from './constructorLayout';
import { CONSTRUCTOR_SOURCE_LABELS, type ConstructorWidget } from './constructorTypes';

const SOURCE_BADGE: Record<ConstructorWidget['kind'], string> = {
  checks: 'bg-blue-50 text-blue-800',
  recommendations: 'bg-rose-50 text-rose-800',
  monitoring: 'bg-amber-50 text-amber-900',
  dva: 'bg-indigo-50 text-indigo-800',
  planning: 'bg-teal-50 text-teal-800',
};

export function ConstructorWidgetCard({
  widget,
  onRemove,
  onContentHeight,
}: {
  widget: ConstructorWidget;
  onRemove: (instanceId: string) => void;
  onContentHeight?: (instanceId: string, height: number) => void;
}) {
  const captureRef = useRef<HTMLElement>(null);
  const naturalRef = useRef<HTMLDivElement>(null);
  const isKpi = widget.payload.chart === 'kpi';
  const isMatrix = isConstructorMatrixChart(widget.payload.chart);
  const fitContent = isKpi || isMatrix;

  useEffect(() => {
    return registerDashboardChart({
      id: widget.instanceId,
      title: widget.title,
      description: widget.filterCaption,
      getNode: () => captureRef.current,
    });
  }, [widget.filterCaption, widget.instanceId, widget.title]);

  useEffect(() => {
    if (!isMatrix || !onContentHeight) {
      return undefined;
    }
    const section = captureRef.current;
    const inner = naturalRef.current;
    if (!section || !inner) {
      return undefined;
    }
    const report = () => {
      const styles = window.getComputedStyle(section);
      const padding =
        Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      onContentHeight(widget.instanceId, Math.ceil(inner.getBoundingClientRect().height + padding));
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [isMatrix, onContentHeight, widget.instanceId, widget.payload]);

  return (
    <section
      ref={captureRef}
      data-analytics-export-capture-id={widget.instanceId}
      data-analytics-export-title={widget.title}
      data-analytics-export-description={widget.filterCaption}
      className="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm"
    >
      <div ref={isMatrix ? naturalRef : undefined} className={isMatrix ? 'flex flex-col' : 'flex min-h-0 flex-1 flex-col'}>
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
            {widget.filterCaption ? (
              <p className="ml-7 break-words text-[11px] leading-snug text-gray-400">
                {widget.filterCaption}
              </p>
            ) : null}
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
            fitContent
              ? 'min-w-0'
              : 'min-h-0 min-w-0 flex-1 lg:[&>*]:!h-full lg:[&_.recharts-responsive-container]:!h-full'
          }
        >
          <ConstructorChartBody payload={widget.payload} />
        </div>
      </div>
    </section>
  );
}
