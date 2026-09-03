/**
 * Constructor board export: one visual sheet matching the assembled dashboard.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { toPng } from 'html-to-image';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { AnalyticsExportFormat } from './analyticsExport';
import { captureDashboardCharts, chartHasPngPayload } from './dashboardChartRegistry';
import type { ConstructorWidget } from '../components/analytics/constructor/constructorTypes';
import { CONSTRUCTOR_GRID_COLS } from '../components/analytics/constructor/constructorLayout';
import {
  buildConstructorDashboardWorkbook,
  CONSTRUCTOR_XLSX_CAPTURE_PIXEL_RATIO,
  constructorXlsxImageExtent,
} from './constructorXlsxLayout';

pdfMake.addVirtualFileSystem(pdfFonts);

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const binary = window.atob(dataUrlToBase64(dataUrl));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

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

function fitImageSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(Math.round(width * ratio), 1),
    height: Math.max(Math.round(height * ratio), 1),
  };
}

async function captureConstructorWidgetCharts(widgets: ConstructorWidget[]) {
  document.body.classList.add('constructor-export-mode');
  try {
    await delay(80);
    const byInstance = new Map(widgets.map((widget) => [widget.instanceId, widget]));
    return await captureDashboardCharts(
      widgets.map((widget) => widget.instanceId),
      {
        skipPng: false,
        pixelRatio: CONSTRUCTOR_XLSX_CAPTURE_PIXEL_RATIO,
        sizeForId: (id, cssSize) => {
          const widget = byInstance.get(id);
          if (!widget) {
            return cssSize;
          }
          const extent = constructorXlsxImageExtent(widget.layout);
          return {
            width: Math.max(extent.width, cssSize.width),
            height: Math.max(extent.height, cssSize.height),
          };
        },
      },
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
  format: AnalyticsExportFormat;
  boardNode: HTMLElement;
  widgets: ConstructorWidget[];
  meta: Array<[string, string]>;
  title?: string;
}) {
  const { format, boardNode, widgets, meta } = options;
  if (widgets.length === 0) {
    throw new Error('На холсте нет графиков');
  }

  const title = options.title?.trim() || 'Конструктор отчёта';
  const filenamePrefix = fileSafeName(title);

  if (format === 'xlsx') {
    const captures = await captureConstructorWidgetCharts(widgets);
    const workbook = buildConstructorDashboardWorkbook({ title, meta, widgets, captures });
    const buffer = await workbook.xlsx.writeBuffer();
    triggerDownload(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${filenamePrefix}-${stamp()}.xlsx`,
    );
    return;
  }

  const dataUrl = await captureConstructorBoard(boardNode, widgets);
  const size = await imageSize(dataUrl);

  if (format === 'html') {
    const metaRows = meta
      .map(
        ([label, value]) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join('');
    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --brand: #003366; --ink: #1a2332; --line: #d7dee7; --bg: #f3f5f7; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: var(--ink); background: var(--bg); }
    .page { width: min(1180px, calc(100% - 32px)); margin: 24px auto 48px; }
    .hero { background: #fff; border: 1px solid var(--line); border-top: 3px solid var(--brand); border-radius: 12px; padding: 22px 24px; margin-bottom: 14px; }
    h1 { margin: 0; color: var(--brand); font-size: 1.6rem; }
    .meta { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; border-bottom: 1px solid var(--line); text-align: left; font-size: 0.9rem; }
    th { width: 220px; color: var(--brand); }
    .sheet { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
    .sheet img { display: block; width: 100%; height: auto; }
    @media print { body { background: #fff; } .page { width: 100%; margin: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <p style="margin:0 0 8px;letter-spacing:.12em;text-transform:uppercase;font-size:.75rem;font-weight:700;color:var(--brand)">SOKOL</p>
      <h1>${escapeHtml(title)}</h1>
    </section>
    <section class="meta"><table>${metaRows}</table></section>
    <section class="sheet">
      <img src="${dataUrl}" alt="${escapeHtml(title)}" width="${size.width}" height="${size.height}" />
    </section>
  </div>
</body>
</html>`;
    triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), `${filenamePrefix}-${stamp()}.html`);
    return;
  }

  if (format === 'pdf') {
    const pageWidth = 1122;
    const headerHeight = 88 + meta.length * 16;
    const fitted = fitImageSize(size.width, size.height, pageWidth - 48, 2200);
    const pageHeight = Math.max(794, headerHeight + fitted.height + 48);
    const docDefinition: TDocumentDefinitions = {
      pageSize: { width: pageWidth, height: pageHeight },
      pageMargins: [24, 24, 24, 24],
      content: [
        { text: title, fontSize: 18, bold: true, color: '#003366', margin: [0, 0, 0, 6] },
        { text: 'Собранный дашборд — один лист в компоновке конструктора', fontSize: 10, color: '#64748B', margin: [0, 0, 0, 10] },
        {
          table: {
            widths: [180, '*'],
            body: meta.map(([label, value]) => [
              { text: label, bold: true, color: '#003366', fontSize: 9 },
              { text: value, fontSize: 9, color: '#334155' },
            ]),
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 12],
        },
        {
          image: dataUrl,
          width: fitted.width,
        },
      ],
    };
    pdfMake.createPdf(docDefinition).download(`${filenamePrefix}-${stamp()}.pdf`);
    return;
  }

  if (format === 'docx') {
    const fitted = fitImageSize(size.width, size.height, 680, 900);
    const metaTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: meta.map(
        ([label, value]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 28, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: '003366' })] })],
              }),
              new TableCell({
                width: { size: 72, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: value })] })],
              }),
            ],
          }),
      ),
    });
    const doc = new Document({
      creator: 'SOKOL',
      title,
      sections: [
        {
          children: [
            new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 120 } }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Собранный дашборд экспортирован одним листом в компоновке конструктора.',
                  color: '64748B',
                }),
              ],
              spacing: { after: 200 },
            }),
            metaTable,
            new Paragraph({ spacing: { before: 240 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: dataUrlToUint8Array(dataUrl),
                  transformation: fitted,
                  type: 'png',
                }),
              ],
            }),
          ],
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    triggerDownload(blob, `${filenamePrefix}-${stamp()}.docx`);
    return;
  }

  throw new Error(`Неизвестный формат экспорта: ${format}`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
