import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { LayoutDashboard, Plus, Trash2 } from 'lucide-react';
import * as ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { AnalyticsDashboardFrame } from '../AnalyticsDashboardFrame';
import {
  FORM_OUTLINE_BUTTON_CLASS,
  FORM_SAVE_BUTTON_CLASS,
} from '../../../constants/formLayout';
import { ANALYTICS_EXPORT_FORMATS, type AnalyticsExportFormat } from '../../../utils/analyticsExport';
import { exportConstructorDashboard } from '../../../utils/constructorVisualExport';
import { useAnalyticsConstructor } from './analyticsConstructorState';
import { ConstructorWidgetCard } from './ConstructorWidgetCard';
import { CONSTRUCTOR_SOURCE_LABELS } from './constructorTypes';
import './constructorBoard.css';

type GridLayoutModule = {
  default?: ComponentType<Record<string, unknown>>;
};

const gridLayoutModule = ReactGridLayout as unknown as GridLayoutModule;
const BaseGridLayout = (gridLayoutModule.default ?? ReactGridLayout) as ComponentType<Record<string, unknown>>;

const GRID_MARGIN = 10;
const ROW_HEIGHT = 76;

export function ConstructorDashboard({ dashboardId }: { dashboardId: string }) {
  const { dashboards, removeWidget, clearBoard, updateLayout, saveDashboard } = useAnalyticsConstructor();
  const widgets = dashboards.find((item) => item.id === dashboardId)?.widgets ?? [];
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(
    () =>
      widgets.map((widget) => ({
        i: widget.instanceId,
        x: widget.layout.x,
        y: widget.layout.y,
        w: widget.layout.w,
        h: widget.layout.h,
        minW: widget.layout.minW,
        minH: widget.layout.minH,
      })),
    [widgets],
  );

  const rowSpan = useMemo(() => {
    if (layout.length === 0) {
      return 8;
    }
    return Math.max(...layout.map((item) => item.y + item.h), 1);
  }, [layout]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }
    const update = () => setContainerWidth(Math.max(Math.floor(node.getBoundingClientRect().width), 320));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [widgets.length]);

  const handleExport = async () => {
    const boardNode = boardRef.current;
    if (!boardNode || widgets.length === 0 || isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      await exportConstructorDashboard({
        format: exportFormat,
        boardNode,
        widgets,
        meta: [
          ['Графиков на листе', String(widgets.length)],
          ['Источники', [...new Set(widgets.map((widget) => CONSTRUCTOR_SOURCE_LABELS[widget.kind]))].join(', ')],
          ['Сформировано', new Date().toLocaleString('ru-RU')],
        ],
      });
    } catch (error) {
      console.error('Constructor export failed', error);
      window.alert(`Не удалось экспортировать дашборд: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = () => {
    saveDashboard(dashboardId);
    setJustSaved(true);
  };

  useEffect(() => {
    if (!justSaved) {
      return undefined;
    }
    const timer = window.setTimeout(() => setJustSaved(false), 1600);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  const sidebar = (
    <aside className="w-full shrink-0 space-y-5 lg:sticky lg:top-4 lg:w-80">
      <section className="rounded-lg bg-gray-100 p-3.5 text-left leading-relaxed">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900">Лист</h3>
          <span className="text-xs font-medium text-gray-500">{widgets.length}</span>
        </div>
        {widgets.length > 0 ? (
          <ul className="max-h-[32rem] space-y-1.5 overflow-auto pr-1">
            {widgets.map((widget, index) => (
              <li key={widget.instanceId} className="flex items-start gap-2 rounded-md bg-white/80 px-2 py-1.5">
                <span className="mt-0.5 w-4 shrink-0 text-xs text-gray-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{widget.title}</p>
                  <p className="truncate text-[11px] text-gray-500">
                    {CONSTRUCTOR_SOURCE_LABELS[widget.kind]} · {widget.filterCaption}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeWidget(dashboardId, widget.instanceId)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-rose-50 hover:text-rose-700"
                  aria-label={`Удалить «${widget.title}»`}
                  title="Удалить"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => clearBoard(dashboardId)}
          disabled={widgets.length === 0}
          className={`${FORM_OUTLINE_BUTTON_CLASS} mt-3 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Очистить лист
        </button>
        <button
          type="button"
          onClick={handleSave}
          className={`${FORM_OUTLINE_BUTTON_CLASS} mt-2 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {justSaved ? 'Сохранено' : 'Сохранить'}
        </button>
      </section>

      <section className="rounded-lg bg-gray-100 p-3.5 text-left leading-relaxed">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void handleExport();
            }}
            disabled={isExporting || widgets.length === 0}
            className={`${FORM_SAVE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isExporting ? 'Экспорт...' : 'Экспорт'}
          </button>
          <select
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as AnalyticsExportFormat)}
            className="form-equal-control h-10 w-32 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20"
          >
            {ANALYTICS_EXPORT_FORMATS.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </div>
      </section>
    </aside>
  );

  return (
    <AnalyticsDashboardFrame sidebar={sidebar} mainClassName="flex min-h-0 min-w-0 flex-1 flex-col">
      {widgets.length === 0 ? (
        <div
          ref={boardRef}
          className="constructor-empty-sheet flex min-h-[32rem] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center"
        >
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-sber-dark">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-sber-dark">Пустой лист отчёта</h3>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <Plus className="h-3.5 w-3.5" />
            Затем переставьте, растяните или удалите блоки на этом листе
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-[32rem] w-full">
          <div ref={boardRef} className="constructor-board rounded-xl bg-white p-1">
            {isDesktop ? (
              <BaseGridLayout
                className="layout constructor-grid"
                layout={layout}
                cols={12}
                width={containerWidth}
                rowHeight={ROW_HEIGHT}
                margin={[GRID_MARGIN, GRID_MARGIN]}
                containerPadding={[4, 4]}
                isDraggable
                isResizable
                compactType="vertical"
                draggableHandle=".constructor-drag-handle"
                style={{ minHeight: rowSpan * (ROW_HEIGHT + GRID_MARGIN) }}
                onLayoutChange={(next: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
                  updateLayout(dashboardId, next);
                }}
              >
                {widgets.map((widget) => (
                  <div key={widget.instanceId} className="min-h-0">
                    <ConstructorWidgetCard
                      widget={widget}
                      onRemove={(instanceId) => removeWidget(dashboardId, instanceId)}
                    />
                  </div>
                ))}
              </BaseGridLayout>
            ) : (
              <div className="space-y-2.5">
                {widgets.map((widget) => (
                  <div key={widget.instanceId} className="min-h-[16rem]">
                    <ConstructorWidgetCard
                      widget={widget}
                      onRemove={(instanceId) => removeWidget(dashboardId, instanceId)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AnalyticsDashboardFrame>
  );
}
