/**
 * Constructor board export: one visual sheet matching the assembled dashboard.
 */
import { toPng } from 'html-to-image';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import { CONSTRUCTOR_GRID_COLS } from '../constants/constructorGrid';
import { buildConstructorDashboardHtml } from './constructorHtmlExport';
import { captureDashboardCharts, chartHasPngPayload } from './dashboardChartRegistry';
import { downloadBlob } from './download';
import { fitImageSize, stamp } from './visualExport/shared';

pdfMake.addVirtualFileSystem(pdfFonts);

export const CONSTRUCTOR_EXPORT_FORMATS = [
  { value: 'html', label: 'HTML' },
  { value: 'pdf', label: 'PDF' },
] as const;

export type ConstructorExportFormat = (typeof CONSTRUCTOR_EXPORT_FORMATS)[number]['value'];

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    image.onerror = () => reject(new Error('Не удалось прочитать снимок дашборда'));
    image.src = dataUrl;
  });
}

async function captureConstructorWidgetCharts(
  widgets: ConstructorWidget[],
  options?: { skipPng?: boolean },
) {
  document.body.classList.add('constructor-export-mode');
  try {
    await delay(80);
    return await captureDashboardCharts(
      widgets.map((widget) => widget.instanceId),
      { skipPng: options?.skipPng ?? false },
    );
  } finally {
    document.body.classList.remove('constructor-export-mode');
  }
}

async function composeFromWidgets(widgets: ConstructorWidget[]): Promise<string> {
  const captures = await captureConstructorWidgetCharts(widgets);
  const byId = new Map(captures.filter((item) => chartHasPngPayload(item.dataUrl)).map((item) => [item.id, item]));
  const cellW = 160;
  const cellH = 96;
  const maxY = Math.max(...widgets.map((widget) => widget.layout.y + widget.layout.h), 1);
  const canvas = document.createElement('canvas');
  canvas.width = CONSTRUCTOR_GRID_COLS * cellW;
  canvas.height = maxY * cellH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось собрать лист конструктора');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await Promise.all(
    widgets.map(
      (widget) =>
        new Promise<void>((resolve) => {
          const capture = byId.get(widget.instanceId);
          const dx = widget.layout.x * cellW + 6;
          const dy = widget.layout.y * cellH + 6;
          const dw = widget.layout.w * cellW - 12;
          const dh = widget.layout.h * cellH - 12;
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(dx, dy, dw, dh);
          ctx.strokeStyle = '#e2e8f0';
          ctx.strokeRect(dx, dy, dw, dh);
          if (!capture) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Segoe UI, sans-serif';
            ctx.fillText(widget.title, dx + 12, dy + 28);
            resolve();
            return;
          }
          const image = new Image();
          image.onload = () => {
            const fitted = fitImageSize(image.naturalWidth, image.naturalHeight, dw - 8, dh - 8);
            const ox = dx + (dw - fitted.width) / 2;
            const oy = dy + (dh - fitted.height) / 2;
            ctx.drawImage(image, ox, oy, fitted.width, fitted.height);
            resolve();
          };
          image.onerror = () => resolve();
          image.src = capture.dataUrl;
        }),
    ),
  );

  return canvas.toDataURL('image/png');
}

export async function captureConstructorBoard(boardNode: HTMLElement, widgets: ConstructorWidget[]): Promise<string> {
  document.body.classList.add('constructor-export-mode');
  try {
    await delay(80);
    const dataUrl = await toPng(boardNode, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
    if (dataUrl && dataUrl.startsWith('data:image/png')) {
      return dataUrl;
    }
  } catch (error) {
    console.error('Constructor board capture failed, falling back to widget mosaic', error);
  } finally {
    document.body.classList.remove('constructor-export-mode');
  }
  return composeFromWidgets(widgets);
}

function fileSafeName(name: string) {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.slice(0, 60) || 'analytics-constructor';
}

export async function exportConstructorDashboard(options: {
  format: ConstructorExportFormat;
  boardNode: HTMLElement;
  widgets: ConstructorWidget[];
  title?: string;
}) {
  const { format, boardNode, widgets } = options;
  if (widgets.length === 0) {
    throw new Error('На холсте нет графиков');
  }

  const title = options.title?.trim() || 'Конструктор отчёта';
  const filenamePrefix = fileSafeName(title);

  if (format === 'html') {
    const captures = await captureConstructorWidgetCharts(widgets, { skipPng: true });
    const html = buildConstructorDashboardHtml({ title, widgets, captures });
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${filenamePrefix}-${stamp()}.html`);
    return;
  }

  if (format === 'pdf') {
    const dataUrl = await captureConstructorBoard(boardNode, widgets);
    const size = await imageSize(dataUrl);
    const pageWidth = 1122;
    const fitted = fitImageSize(size.width, size.height, pageWidth - 48, 2200);
    const pageHeight = Math.max(794, fitted.height + 48);
    const docDefinition: TDocumentDefinitions = {
      pageSize: { width: pageWidth, height: pageHeight },
      pageMargins: [24, 24, 24, 24],
      content: [
        {
          image: dataUrl,
          width: fitted.width,
        },
      ],
    };
    pdfMake.createPdf(docDefinition).download(`${filenamePrefix}-${stamp()}.pdf`);
  }
}
