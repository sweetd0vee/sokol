import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import { Clipboard, Expand, FileDown, Image, Minimize2, MoreVertical, X } from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { registerDashboardChart } from '../../utils/dashboardChartRegistry';

pdfMake.addVirtualFileSystem(pdfFonts);

export type AnalyticsExportSection = {
  id: string;
  label: string;
};

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

async function captureNode(node: HTMLElement, format: 'png' | 'jpeg' | 'svg') {
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  };
  if (format === 'jpeg') {
    return toJpeg(node, { ...options, quality: 0.95 });
  }
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
  onDownload: (format: 'png' | 'jpeg' | 'svg' | 'pdf') => void;
  onCopyPng: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {onToggleExport ? (
        <label className="inline-flex min-w-[6rem] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(exportSelected)}
            onChange={onToggleExport}
            className="h-3.5 w-3.5 accent-sber-dark"
          />
          В отчёт
        </label>
      ) : null}

      <button
        type="button"
        onClick={onToggleFullscreen}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:text-slate-300 dark:hover:border-sber-light/70 dark:hover:text-sber-light"
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
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-sber-dark/40 hover:text-sber-dark disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-sber-light/70 dark:hover:text-sber-light"
          title={isBusy ? 'Сохранение…' : 'Ещё'}
          aria-label="Ещё"
          aria-haspopup="menu"
          aria-expanded={isDownloadOpen}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {isDownloadOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
          >
            <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Скачать
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => onDownload('png')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Image className="h-3.5 w-3.5 text-sky-600" />
              PNG
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onDownload('jpeg')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Image className="h-3.5 w-3.5 text-amber-600" />
              JPG
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onDownload('svg')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Image className="h-3.5 w-3.5 text-violet-600" />
              SVG
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onDownload('pdf')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <FileDown className="h-3.5 w-3.5 text-rose-600" />
              PDF
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onCopyPng}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
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
  accentClassName = 'border-gray-200 dark:border-slate-700',
  exportSectionId,
  exportSelected,
  onToggleExport,
  onResetCardLayout: _onResetCardLayout,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  accentClassName?: string;
  exportSectionId?: string;
  exportSelected?: boolean;
  onToggleExport?: () => void;
  onResetCardLayout?: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!exportSectionId) {
      return undefined;
    }
    return registerDashboardChart({
      id: exportSectionId,
      title,
      description,
      getNode: () => captureRef.current,
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

  const handleDownload = async (format: 'png' | 'jpeg' | 'svg' | 'pdf') => {
    const node = captureRef.current;
    if (!node || isBusy) {
      return;
    }
    setIsBusy(true);
    setIsDownloadOpen(false);
    try {
      const baseName = `sokol-${slugifyFilename(title)}`;
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
      const extension = format === 'jpeg' ? 'jpg' : format;
      downloadDataUrl(dataUrl, `${baseName}.${extension}`);
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
      className={
        isFullscreen
          ? 'h-[min(75vh,720px)] overflow-auto rounded-lg bg-white p-2 [&>*]:!h-full [&_.h-40]:!h-full [&_.h-48]:!h-full [&_.h-52]:!h-full [&_.h-56]:!h-full [&_.h-64]:!h-full [&_.h-72]:!h-full [&_.max-h-40]:!max-h-full'
          : 'rounded-lg bg-white [&_.h-40]:!h-36 [&_.max-h-40]:!max-h-36 lg:min-h-0 lg:flex-1 lg:[&>*]:!h-full lg:[&_.h-40]:!h-full lg:[&_.h-36]:!h-full lg:[&_.max-h-40]:!max-h-full'
      }
    >
      {children}
    </div>
  );

  if (!isFullscreen) {
    return (
      <section
        className={`flex h-full flex-col rounded-xl border bg-white p-2.5 shadow-sm dark:bg-slate-800 ${accentClassName} ${className}`}
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="inline-flex items-center rounded-md pr-1 text-sber-dark dark:text-sber-light">
              <h3 className="text-sm font-semibold leading-snug">{title}</h3>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">{description}</p>
          </div>
          {toolbar}
        </div>
        {chartBody}
      </section>
    );
  }

  return (
    <>
      <section
        className={`rounded-xl border bg-white p-4 opacity-70 shadow-sm dark:bg-slate-800 ${accentClassName} ${className}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-semibold text-sber-dark dark:text-sber-light">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 dark:border-slate-600">
          Открыто на весь экран
        </div>
      </section>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
        onClick={() => setIsFullscreen(false)}
        role="presentation"
      >
        <div
          className={`flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-slate-800 ${accentClassName}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-slate-700">
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-base font-semibold text-sber-dark dark:text-sber-light">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{description}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {toolbar}
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-600 dark:text-slate-300"
                title="Закрыть"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="p-4">{chartBody}</div>
        </div>
      </div>
    </>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  suffix,
  tone = 'blue',
}: {
  label: string;
  value: number;
  hint?: string;
  suffix?: string;
  tone?: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100',
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100',
    red: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100',
    amber:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100',
    violet:
      'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100',
    slate:
      'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
  };

  return (
    <div className={`rounded-xl border px-3.5 py-2.5 ${tones[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">
        {value}
        {suffix ? <span className="ml-0.5 text-sm font-medium">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] opacity-70">{hint}</p> : null}
    </div>
  );
}

export function EmptyChart({ message, heightClass = 'h-36' }: { message: string; heightClass?: string }) {
  return (
    <div
      className={`flex ${heightClass} items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400`}
    >
      {message}
    </div>
  );
}

export function ExportSectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearAll,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
      <span>
        В отчёт: {selectedCount} / {totalCount}
      </span>
      <button
        type="button"
        onClick={onSelectAll}
        className="rounded border border-gray-300 px-2 py-0.5 hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:hover:border-sber-light/70 dark:hover:text-sber-light"
      >
        Все
      </button>
      <button
        type="button"
        onClick={onClearAll}
        className="rounded border border-gray-300 px-2 py-0.5 hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:hover:border-sber-light/70 dark:hover:text-sber-light"
      >
        Ничего
      </button>
    </div>
  );
}

