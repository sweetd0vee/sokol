import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clipboard, Expand, Minimize2, X } from 'lucide-react';
import { registerDashboardChart } from '../../utils/dashboardChartRegistry';
import { useAnalyticsFilterCaption } from './analyticsFilterCaptionContext';
import { captureChartPngWithFilters, captureNodePng } from './chartPngCapture';

function ChartToolbar({
  exportSelected,
  onToggleExport,
  isFullscreen,
  onToggleFullscreen,
  isBusy,
  isCopyOpen,
  onToggleCopy,
  menuRef,
  onCopyPng,
}: {
  exportSelected?: boolean;
  onToggleExport?: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isBusy: boolean;
  isCopyOpen: boolean;
  onToggleCopy: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onCopyPng: (includeFilters: boolean) => void;
}) {
  return (
    <div data-chart-toolbar className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {onToggleExport ? (
        <button
          type="button"
          onClick={onToggleExport}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark"
          title="В конструктор"
          aria-label="В конструктор"
          aria-pressed={Boolean(exportSelected)}
        >
          <span
            className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] ${
              exportSelected
                ? 'border border-sber-dark bg-white text-sber-dark'
                : 'border border-gray-400 bg-white text-transparent'
            }`}
            aria-hidden
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        </button>
      ) : null}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={onToggleCopy}
          disabled={isBusy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark disabled:opacity-50"
          title={isBusy ? 'Копирование…' : 'Скопировать PNG'}
          aria-label="Скопировать PNG"
          aria-haspopup="menu"
          aria-expanded={isCopyOpen}
        >
          <Clipboard className="h-3.5 w-3.5" />
        </button>
        {isCopyOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              PNG в буфер обмена
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => onCopyPng(true)}
              className="flex w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              С фильтрами
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onCopyPng(false)}
              className="flex w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              Без фильтров
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggleFullscreen}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark"
        title={isFullscreen ? 'Свернуть' : 'На весь экран'}
        aria-label={isFullscreen ? 'Свернуть' : 'На весь экран'}
      >
        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  className = '',
  accentClassName = 'border-gray-200 ',
  exportSectionId,
  exportSelected,
  onToggleExport,
  dense = false,
  fitContent = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  accentClassName?: string;
  exportSectionId?: string;
  exportSelected?: boolean;
  onToggleExport?: () => void;
  dense?: boolean;
  fitContent?: boolean;
}) {
  const exportCardRef = useRef<HTMLElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const filterCaption = useAnalyticsFilterCaption();
  const exportCaptureAttributes = exportSectionId
    ? {
        'data-analytics-export-capture-id': exportSectionId,
        'data-analytics-export-title': title,
        'data-analytics-export-description': description || filterCaption,
      }
    : {};

  useEffect(() => {
    if (!exportSectionId) {
      return undefined;
    }
    return registerDashboardChart({
      id: exportSectionId,
      title,
      description: description || filterCaption,
      getNode: () => {
        const capture = captureRef.current;
        const card = exportCardRef.current;
        if (capture && card) {
          const captureArea = capture.getBoundingClientRect().width * capture.getBoundingClientRect().height;
          // Prefer the chart body, but fall back to the whole card if the body collapsed.
          return captureArea >= 64 ? capture : card;
        }
        return capture ?? card;
      },
    });
  }, [exportSectionId, title, description, filterCaption]);

  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
        setIsCopyOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isCopyOpen) {
      return undefined;
    }
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) {
        return;
      }
      setIsCopyOpen(false);
    };
    window.addEventListener('mousedown', handlePointer);
    return () => window.removeEventListener('mousedown', handlePointer);
  }, [isCopyOpen]);

  const handleCopyPng = async (includeFilters: boolean) => {
    const node = captureRef.current;
    if (!node || isBusy) {
      return;
    }
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      window.alert('Буфер обмена для изображений недоступен в этом браузере');
      return;
    }
    setIsBusy(true);
    setIsCopyOpen(false);

    try {
      const dataUrl = includeFilters
        ? await captureChartPngWithFilters(node, title, filterCaption)
        : await captureNodePng(node);
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch (error) {
      console.error('Chart copy failed', error);
      window.alert(
        `Не удалось скопировать график: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const toolbar = (
    <ChartToolbar
      exportSelected={exportSelected}
      onToggleExport={onToggleExport}
      isFullscreen={isFullscreen}
      onToggleFullscreen={() => setIsFullscreen((value) => !value)}
      isBusy={isBusy}
      isCopyOpen={isCopyOpen}
      onToggleCopy={() => setIsCopyOpen((value) => !value)}
      menuRef={menuRef}
      onCopyPng={(includeFilters) => {
        void handleCopyPng(includeFilters);
      }}
    />
  );

  const chartBody = (
    <div
      ref={captureRef}
      {...exportCaptureAttributes}
      className={
        isFullscreen
          ? fitContent
            ? 'h-full min-h-0 overflow-auto rounded-lg bg-white p-2'
            : 'h-full min-h-0 overflow-auto rounded-lg bg-white p-2 [&>*]:!h-full [&_.recharts-responsive-container]:!h-full'
          : fitContent
            ? 'min-w-0 rounded-lg bg-white'
            : 'min-h-[13rem] rounded-lg bg-white lg:min-h-0 lg:flex-1 lg:[&>*]:!h-full lg:[&_.recharts-responsive-container]:!h-full'
      }
    >
      {children}
    </div>
  );

  if (!isFullscreen) {
    if (dense) {
      return (
        <section
          ref={exportCardRef}
          className={`flex w-full flex-col rounded-lg border bg-white px-2 py-1.5 shadow-sm ${accentClassName} ${className}`}
        >
          <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
            <h3 className="shrink-0 text-sm font-semibold leading-snug text-sber-dark">{title}</h3>
            {toolbar}
          </div>
          <div ref={captureRef} {...exportCaptureAttributes} className="min-w-0">
            {children}
          </div>
        </section>
      );
    }

    return (
      <section
        ref={exportCardRef}
        className={`${fitContent ? 'flex w-full min-w-0 flex-col' : 'flex h-full flex-col'} rounded-lg border bg-white p-1.5 shadow-sm ${accentClassName} ${className}`}
      >
        <div className="mb-0.5 flex items-start justify-between gap-1.5">
          <div className="min-w-0 space-y-0">
            <div className="inline-flex items-center rounded-md pr-1 text-sber-dark">
              <h3 className="text-sm font-semibold leading-snug">{title}</h3>
            </div>
            {description ? (
              <p className="text-xs leading-snug text-gray-500">{description}</p>
            ) : null}
          </div>
          {toolbar}
        </div>
        {chartBody}
      </section>
    );
  }

  const fullscreenLayer = (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
        onClick={() => setIsFullscreen(false)}
        role="presentation"
      >
        <div
          className={`flex h-[88vh] w-[92vw] max-w-7xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl ${accentClassName}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4 shadow-sm">
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-base font-semibold text-sber-dark">{title}</h3>
              {description ? <p className="text-sm text-gray-500">{description}</p> : null}
            </div>
            <div className="flex items-center gap-1.5">
              {toolbar}
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-rose-300 hover:text-rose-600"
                title="Закрыть"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-white p-4">{chartBody}</div>
        </div>
      </div>
  );

  return (
    <>
      <section
        className={`rounded-xl border bg-white p-4 opacity-70 shadow-sm ${accentClassName} ${className}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-semibold text-sber-dark">{title}</h3>
            {description ? <p className="text-xs text-gray-500">{description}</p> : null}
          </div>
        </div>
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs text-gray-400">
          Открыто на весь экран
        </div>
      </section>

      {createPortal(fullscreenLayer, document.body)}
    </>
  );
}
