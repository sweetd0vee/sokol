import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { toPng, toSvg } from 'html-to-image';
import { Clipboard, Expand, FileDown, Image, Minimize2, MoreHorizontal, Plus, X } from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { registerDashboardChart } from '../../utils/dashboardChartRegistry';
import { kpiAccentStyle } from './analyticsPalette';

pdfMake.addVirtualFileSystem(pdfFonts);

/** Shared Recharts typography for analytics dashboards. */
export const CHART_AXIS_TICK = { fontSize: 15 } as const;
export const CHART_CATEGORY_AXIS_TICK = { fontSize: 14 } as const;
export const CHART_LEGEND_STYLE = { fontSize: 15, fontWeight: 400, color: '#000000' } as const;
export const CHART_VALUE_LABEL_SIZE = 14;
export const CHART_TOOLTIP_STYLE = {
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
} as const;

export function ChartLegend({
  items,
  fontSize = CHART_LEGEND_STYLE.fontSize,
  fontWeight = CHART_LEGEND_STYLE.fontWeight,
  layout = 'column',
}: {
  items: Array<{ key?: string; color?: string; label: string }>;
  fontSize?: number;
  fontWeight?: number;
  layout?: 'column' | 'row';
}) {
  const isRow = layout === 'row';
  return (
    <ul
      className={
        isRow
          ? 'mx-auto flex w-fit max-w-full list-none flex-row flex-nowrap items-center justify-center gap-x-4 px-2 pb-1 pt-1'
          : 'mx-auto flex w-fit max-w-full list-none flex-col items-start gap-y-1 px-2 pb-1 pt-1'
      }
      style={{
        fontFamily: 'inherit',
        fontSize,
        fontWeight,
        color: CHART_LEGEND_STYLE.color,
      }}
    >
      {items.map((item, index) => (
        <li
          key={item.key ?? `${item.label}-${index}`}
          className="grid grid-cols-[14px_auto] items-center gap-x-2 whitespace-nowrap"
        >
          <span
            className="box-border block h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-left leading-tight" style={{ color: CHART_LEGEND_STYLE.color }}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function slugifyFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'dashboard'
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

async function captureNode(node: HTMLElement, format: 'png' | 'svg') {
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  };
  if (format === 'svg') {
    return toSvg(node, options);
  }
  return toPng(node, options);
}

function ChartToolbar({
  exportSelected,
  onToggleExport,
  isFullscreen,
  onToggleFullscreen,
  isBusy,
  isDownloadOpen,
  onToggleDownload,
  menuRef,
  onDownload,
  onCopyPng,
}: {
  exportSelected?: boolean;
  onToggleExport?: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isBusy: boolean;
  isDownloadOpen: boolean;
  onToggleDownload: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onDownload: (format: 'png' | 'svg' | 'pdf') => void;
  onCopyPng: () => void;
}) {
  return (
    <div data-chart-toolbar className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {onToggleExport ? (
        <button
          type="button"
          onClick={onToggleExport}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark"
          title="В отчёт"
          aria-label="В отчёт"
          aria-pressed={Boolean(exportSelected)}
        >
          <span
            className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] ${
              exportSelected ? 'bg-sber-dark text-white' : 'border border-gray-400 bg-white text-transparent'
            }`}
            aria-hidden
          >
            <Plus className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onToggleFullscreen}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark"
        title={isFullscreen ? 'Свернуть' : 'На весь экран'}
        aria-label={isFullscreen ? 'Свернуть' : 'На весь экран'}
      >
        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={onToggleDownload}
          disabled={isBusy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark disabled:opacity-50"
          title={isBusy ? 'Сохранение…' : 'Ещё'}
          aria-label="Ещё"
          aria-haspopup="menu"
          aria-expanded={isDownloadOpen}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {isDownloadOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Скачать
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => onDownload('png')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              <Image className="h-3.5 w-3.5 text-sky-600" />
              PNG
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onDownload('svg')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              <Image className="h-3.5 w-3.5 text-violet-600" />
              SVG
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onDownload('pdf')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              <FileDown className="h-3.5 w-3.5 text-rose-600" />
              PDF
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onCopyPng}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              <Clipboard className="h-3.5 w-3.5 text-emerald-600" />
              PNG в буфер
            </button>
          </div>
        ) : null}
      </div>
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
}) {
  const exportCardRef = useRef<HTMLElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const exportCaptureAttributes = exportSectionId
    ? {
        'data-analytics-export-capture-id': exportSectionId,
        'data-analytics-export-title': title,
        'data-analytics-export-description': description,
      }
    : {};

  useEffect(() => {
    if (!exportSectionId) {
      return undefined;
    }
    return registerDashboardChart({
      id: exportSectionId,
      title,
      description,
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
  }, [exportSectionId, title, description]);

  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
        setIsDownloadOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isDownloadOpen) {
      return undefined;
    }
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) {
        return;
      }
      setIsDownloadOpen(false);
    };
    window.addEventListener('mousedown', handlePointer);
    return () => window.removeEventListener('mousedown', handlePointer);
  }, [isDownloadOpen]);

  const handleDownload = async (format: 'png' | 'svg' | 'pdf') => {
    const node = captureRef.current;
    if (!node || isBusy) {
      return;
    }
    setIsBusy(true);
    setIsDownloadOpen(false);
    try {
      const baseName =`sokol-${slugifyFilename(title)}`;
      if (format === 'pdf') {
        const dataUrl = await captureNode(node, 'png');
        const docDefinition: TDocumentDefinitions = {
          pageSize: 'A4',
          pageOrientation: 'landscape',
          pageMargins: [24, 28, 24, 28],
          content: [
            {
              text: title,
              fontSize: 16,
              bold: true,
              color: '#003366',
              margin: [0, 0, 0, 4],
            },
            {
              text: description,
              fontSize: 10,
              color: '#64748B',
              margin: [0, 0, 0, 12],
            },
            {
              image: dataUrl,
              width: 740,
            },
          ],
          defaultStyle: { font: 'Roboto' },
        };
        pdfMake.createPdf(docDefinition).download(`${baseName}.pdf`);
        return;
      }

      const dataUrl = await captureNode(node, format);
      downloadDataUrl(dataUrl,`${baseName}.${format}`);
    } catch (error) {
      console.error('Chart download failed', error);
      window.alert(
`Не удалось скачать график: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyPng = async () => {
    const node = captureRef.current;
    if (!node || isBusy) {
      return;
    }
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      window.alert('Буфер обмена для изображений недоступен в этом браузере');
      return;
    }
    setIsBusy(true);
    setIsDownloadOpen(false);
    try {
      const dataUrl = await captureNode(node, 'png');
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
      isDownloadOpen={isDownloadOpen}
      onToggleDownload={() => setIsDownloadOpen((value) => !value)}
      menuRef={menuRef}
      onDownload={(format) => {
        void handleDownload(format);
      }}
      onCopyPng={() => {
        void handleCopyPng();
      }}
    />
  );

  const chartBody = (
    <div
      ref={captureRef}
      {...exportCaptureAttributes}
      className={
        isFullscreen
          ? 'h-full min-h-0 overflow-auto rounded-lg bg-white p-2 [&>*]:!h-full [&_.recharts-responsive-container]:!h-full'
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
        className={`flex h-full flex-col rounded-lg border bg-white p-1.5 shadow-sm ${accentClassName} ${className}`}
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

export function KpiCard({
  label,
  value,
  hint,
  suffix,
  tone = 'blue',
  accentColor,
}: {
  label: string;
  value: number;
  hint?: string;
  suffix?: string;
  tone?: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate' | 'lilac' | 'indigo' | 'fuchsia' | 'purple';
  /** Chart swatch hex; when set, overrides `tone` with a more transparent wash. */
  accentColor?: string;
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900 ',
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-900 ',
    red: 'border-rose-200 bg-rose-50 text-rose-900 ',
    amber:
      'border-[#FBEB8D]/50 bg-[#FBEB8D]/25 text-slate-900 ',
    violet:
      'border-violet-200 bg-violet-50 text-violet-900 ',
    lilac:
      'border-purple-200 bg-purple-50 text-purple-900 ',
    indigo:
      'border-indigo-200 bg-indigo-50 text-indigo-900 ',
    fuchsia:
      'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 ',
    purple:
      'border-violet-300 bg-violet-100 text-violet-950 ',
    slate:
      'border-slate-200 bg-slate-50 text-slate-900 ',
  };

  return (
    <div
      className={`flex min-h-[5rem] items-center justify-between gap-2 rounded-lg border px-3 py-3.5 ${accentColor ? '' : tones[tone]}`}
      style={accentColor ? kpiAccentStyle(accentColor) : undefined}
    >
      <div className="min-w-0">
        <p className="truncate text-sm leading-none opacity-80">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-xs leading-none opacity-60">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-xl font-semibold leading-none">
        {value}
        {suffix ? <span className="ml-0.5 text-base font-medium">{suffix}</span> : null}
      </p>
    </div>
  );
}

export function EmptyChart({ message, heightClass = 'h-24' }: { message: string; heightClass?: string }) {
  return (
    <div
      className={`flex ${heightClass} items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500`}
    >
      {message}
    </div>
  );
}

