import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { GripVertical, LayoutDashboard, Trash2 } from 'lucide-react';
import { AnalyticsDashboardFrame } from '../AnalyticsDashboardFrame';
import {
  FORM_OUTLINE_BUTTON_CLASS,
  FORM_SAVE_BUTTON_CLASS,
} from '../../../constants/formLayout';
import { CONSTRUCTOR_EXPORT_FORMATS, exportConstructorDashboard, type ConstructorExportFormat } from '../../../utils/constructorVisualExport';
import { useAnalyticsConstructor } from './analyticsConstructorState';
import { ConstructorWidgetCard } from './ConstructorWidgetCard';
import {
  CONSTRUCTOR_GRID_MARGIN,
  CONSTRUCTOR_ROW_HEIGHT,
  isConstructorMatrixChart,
  pixelHeightToGridRows,
} from './constructorLayout';
import { CONSTRUCTOR_SOURCE_LABELS } from './constructorTypes';
import { BaseGridLayout } from '../reactGridLayout';
import './constructorBoard.css';

const GRID_MARGIN = CONSTRUCTOR_GRID_MARGIN;
const ROW_HEIGHT = CONSTRUCTOR_ROW_HEIGHT;

function useSheetListReorder(onReorder: (fromIndex: number, toIndex: number) => void) {
  const sessionRef = useRef<{ from: number; over: number } | null>(null);
  const onReorderRef = useRef(onReorder);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    onReorderRef.current = onReorder;
  }, [onReorder]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = { from: index, over: index };
    setDraggingIndex(index);
    setOverIndex(index);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const item = target instanceof Element ? target.closest('[data-constructor-sheet-item]') : null;
    if (!(item instanceof HTMLElement)) {
      return;
    }
    const next = Number(item.dataset.index);
    if (!Number.isInteger(next) || next === session.over) {
      return;
    }
    session.over = next;
    setOverIndex(next);
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (session && session.from !== session.over) {
      onReorderRef.current(session.from, session.over);
    }
  };

  return { draggingIndex, overIndex, handlePointerDown, handlePointerMove, endDrag };
}

export function ConstructorDashboard({ dashboardId }: { dashboardId: string }) {
  const { dashboards, removeWidget, reorderWidgets, clearBoard, updateLayout } = useAnalyticsConstructor();
  const dashboard = useMemo(
    () => dashboards.find((item) => item.id === dashboardId) ?? null,
    [dashboards, dashboardId],
  );
  const widgets = useMemo(() => dashboard?.widgets ?? [], [dashboard]);
  const [exportFormat, setExportFormat] = useState<ConstructorExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const canReorder = widgets.length > 1;
  const { draggingIndex, overIndex, handlePointerDown, handlePointerMove, endDrag } = useSheetListReorder(
    (fromIndex, toIndex) => reorderWidgets(dashboardId, fromIndex, toIndex),
  );

  const handleListKeyDown = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
    if (!canReorder) {
      return;
    }
    if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      reorderWidgets(dashboardId, index, index - 1);
    } else if (event.key === 'ArrowDown' && index < widgets.length - 1) {
      event.preventDefault();
      reorderWidgets(dashboardId, index, index + 1);
    }
  };

  const boardWidgets = useMemo(
    () => [...widgets].sort((left, right) => left.instanceId.localeCompare(right.instanceId)),
    [widgets],
  );

  const stackedWidgets = useMemo(
    () =>
      [...widgets].sort(
        (left, right) =>
          left.layout.y - right.layout.y
          || left.layout.x - right.layout.x
          || left.instanceId.localeCompare(right.instanceId),
      ),
    [widgets],
  );

  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;
  const matrixHeightsRef = useRef<Record<string, number>>({});

  const layout = useMemo(
    () =>
      boardWidgets.map((widget) => {
        const item = {
          i: widget.instanceId,
          x: widget.layout.x,
          y: widget.layout.y,
          w: widget.layout.w,
          h: widget.layout.h,
          minW: widget.layout.minW,
          minH: widget.layout.minH,
        };
        if (!isConstructorMatrixChart(widget.payload.chart)) {
          return item;
        }
        return { ...item, resizeHandles: ['e'] };
      }),
    [boardWidgets],
  );

  const handleMatrixContentHeight = useCallback(
    (instanceId: string, pixelHeight: number) => {
      const widget = widgetsRef.current.find((item) => item.instanceId === instanceId);
      if (!widget || !isConstructorMatrixChart(widget.payload.chart)) {
        return;
      }
      const nextH = pixelHeightToGridRows(pixelHeight, widget.layout.minH);
      matrixHeightsRef.current[instanceId] = nextH;
      if (nextH === widget.layout.h) {
        return;
      }
      updateLayout(
        dashboardId,
        widgetsRef.current.map((item) => ({
          i: item.instanceId,
          x: item.layout.x,
          y: item.layout.y,
          w: item.layout.w,
          h: item.instanceId === instanceId ? nextH : item.layout.h,
        })),
      );
    },
    [dashboardId, updateLayout],
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
        title: dashboard?.name,
      });
    } catch (error) {
      console.error('Constructor export failed', error);
      window.alert(`Не удалось экспортировать дашборд: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const sidebar = (
    <aside className="w-full shrink-0 space-y-5 lg:sticky lg:top-4 lg:w-80">
      <section className="rounded-lg bg-gray-100 p-3.5 text-left leading-relaxed">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900">Лист</h3>
          <span className="text-xs font-medium text-gray-500">{widgets.length}</span>
        </div>
        {widgets.length > 0 ? (
          <ul
            className={`space-y-1.5 pr-1 ${draggingIndex !== null ? 'select-none' : ''}`}
            aria-label="Порядок графиков на листе"
          >
            {widgets.map((widget, index) => {
              const isDragging = draggingIndex === index;
              const isDropTarget = overIndex === index && draggingIndex !== null && draggingIndex !== index;
              return (
                <li
                  key={widget.instanceId}
                  data-constructor-sheet-item
                  data-index={index}
                  tabIndex={canReorder ? 0 : undefined}
                  onKeyDown={(event) => handleListKeyDown(event, index)}
                  className={`flex items-start gap-2 rounded-md bg-white/80 px-2 py-1.5 outline-none ${
                    isDragging ? 'opacity-50' : ''
                  } ${isDropTarget ? 'ring-1 ring-sber-dark' : ''} ${
                    canReorder ? 'focus-visible:ring-1 focus-visible:ring-sber-dark' : ''
                  }`}
                >
                  {canReorder ? (
                    <span
                      role="button"
                      tabIndex={-1}
                      className="inline-flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-gray-400 hover:bg-gray-50 hover:text-gray-600 active:cursor-grabbing"
                      aria-label={`Переместить «${widget.title}»`}
                      title="Перетащить"
                      onPointerDown={(event) => handlePointerDown(event, index)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
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
              );
            })}
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
            onChange={(event) => setExportFormat(event.target.value as ConstructorExportFormat)}
            className="form-equal-control h-10 w-32 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20"
          >
            {CONSTRUCTOR_EXPORT_FORMATS.map((format) => (
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
                  updateLayout(
                    dashboardId,
                    next.map((item) => {
                      const lockedH = matrixHeightsRef.current[item.i];
                      return lockedH === undefined ? item : { ...item, h: lockedH };
                    }),
                  );
                }}
              >
                {boardWidgets.map((widget) => (
                  <div key={widget.instanceId} className="min-h-0">
                    <ConstructorWidgetCard
                      widget={widget}
                      onRemove={(instanceId) => removeWidget(dashboardId, instanceId)}
                      onContentHeight={handleMatrixContentHeight}
                    />
                  </div>
                ))}
              </BaseGridLayout>
            ) : (
              <div className="space-y-2.5">
                {stackedWidgets.map((widget) => (
                  <div key={widget.instanceId} className="min-h-[16rem]">
                    <ConstructorWidgetCard
                      widget={widget}
                      onRemove={(instanceId) => removeWidget(dashboardId, instanceId)}
                      onContentHeight={handleMatrixContentHeight}
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
