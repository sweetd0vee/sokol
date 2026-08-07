/**
 * Bulk analytics export as chart images laid out on PDF/XLSX sheets.
 */
import ExcelJS from 'exceljs';
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
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  CHECK_EXPORT_SECTIONS,
  DVA_EXPORT_SECTIONS,
  MONITORING_EXPORT_SECTIONS,
  RECOMMENDATION_EXPORT_SECTIONS,
} from '../constants/analyticsExportSections';
import {
  captureDashboardCharts,
  isUsefulSvgMarkup,
  type DashboardChartCapture,
} from './dashboardChartRegistry';

pdfMake.addVirtualFileSystem(pdfFonts);

export type VisualExportMetaRow = [string, string];

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export type VisualAnalyticsKind = 'checks' | 'recommendations' | 'monitoring' | 'dva';

function sheetNameForSection(kind: VisualAnalyticsKind, sectionId: string, fallbackTitle: string) {
  const catalog =
    kind === 'checks'
      ? CHECK_EXPORT_SECTIONS
      : kind === 'recommendations'
        ? RECOMMENDATION_EXPORT_SECTIONS
        : kind === 'monitoring'
          ? MONITORING_EXPORT_SECTIONS
          : DVA_EXPORT_SECTIONS;
  const found = catalog.find((section) => section.id === sectionId);
  const raw = found?.sheetName ?? fallbackTitle;
  return raw.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Дашборд';
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

function fitImageSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(Math.round(width * ratio), 1),
    height: Math.max(Math.round(height * ratio), 1),
  };
}

async function buildVisualPdf(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, filenamePrefix } = options;
  const content: Content[] = [
    {
      text: documentTitle,
      fontSize: 20,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 8],
    },
    {
      text: 'Отчёт по выбранным дашбордам — графики как на экране',
      fontSize: 11,
      color: '#64748B',
      margin: [0, 0, 0, 16],
    },
    {
      table: {
        widths: [180, '*'],
        body: meta.map(([label, value]) => [
          { text: label, bold: true, color: '#003366', fontSize: 10 },
          { text: value, fontSize: 10, color: '#334155' },
        ]),
      },
      layout: {
        hLineColor: () => '#E2E8F0',
        vLineColor: () => '#E2E8F0',
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
      margin: [0, 0, 0, 18],
    },
  ];

  charts.forEach((chart, index) => {
    if (index > 0) {
      content.push({ text: '', pageBreak: 'before' });
    }
    const fitted = fitImageSize(chart.width * 2, chart.height * 2, 760, 430);
    content.push({
      text: chart.title,
      fontSize: 15,
      bold: true,
      color: '#003366',
      margin: [0, 0, 0, 4],
    });
    content.push({
      text: chart.description,
      fontSize: 10,
      color: '#64748B',
      margin: [0, 0, 0, 12],
    });
    content.push({
      image: chart.dataUrl,
      width: fitted.width,
      alignment: 'center',
      margin: [0, 8, 0, 0],
    });
  });

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 32, 28, 32],
    content,
    footer: (currentPage, pageCount) => ({
      text: `SOKOL · ${currentPage} / ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: '#94A3B8',
      margin: [0, 8, 0, 0],
    }),
    defaultStyle: { font: 'Roboto' },
  };

  pdfMake.createPdf(doc).download(`${filenamePrefix}-${stamp()}.pdf`);
}

async function buildVisualXlsx(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  kind: VisualAnalyticsKind;
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, kind, filenamePrefix } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SOKOL';
  workbook.created = new Date();

  const cover = workbook.addWorksheet('Обложка', {
    properties: { tabColor: { argb: 'FF003366' } },
    views: [{ showGridLines: false }],
  });
  cover.columns = [{ width: 28 }, { width: 56 }];
  cover.mergeCells('A1:B1');
  cover.getCell('A1').value = documentTitle;
  cover.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF003366' } };
  cover.getCell('A2').value = 'Выбранные дашборды экспортированы как изображения графиков';
  cover.getCell('A2').font = { name: 'Calibri', size: 11, color: { argb: 'FF64748B' } };
  cover.mergeCells('A2:B2');

  meta.forEach(([label, value], index) => {
    const row = index + 4;
    cover.getCell(`A${row}`).value = label;
    cover.getCell(`A${row}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
    cover.getCell(`B${row}`).value = value;
    cover.getCell(`B${row}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF334155' } };
  });

  const usedNames = new Set<string>(['Обложка']);
  for (const [index, chart] of charts.entries()) {
    let sheetName = sheetNameForSection(kind, chart.id, chart.title);
    if (usedNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 28)}_${index + 1}`;
    }
    usedNames.add(sheetName);

    const sheet = workbook.addWorksheet(sheetName, {
      properties: { tabColor: { argb: 'FF4F7FA8' } },
      views: [{ showGridLines: false }],
    });
    sheet.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = chart.title;
    sheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
    sheet.getRow(1).height = 24;
    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = chart.description;
    sheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } };
    sheet.getRow(2).height = 18;

    const imageId = workbook.addImage({
      // ExcelJS strips a data-URL prefix at the first comma; keep a full data URL.
      base64: chart.dataUrl.startsWith('data:')
        ? chart.dataUrl
        : `data:image/png;base64,${chart.dataUrl}`,
      extension: 'png',
    });

    const fitted = fitImageSize(chart.width * 2, chart.height * 2, 960, 520);
    sheet.addImage(imageId, {
      tl: { col: 0.15, row: 2.8 },
      ext: { width: fitted.width, height: fitted.height },
      editAs: 'oneCell',
    });
    sheet.getRow(20).height = Math.max(Math.round(fitted.height * 0.75), 120);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

async function buildVisualDocx(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, filenamePrefix } = options;
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: meta.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 32, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label, bold: true, color: '003366' })],
                }),
              ],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(value)] })],
            }),
          ],
        }),
    ),
  });

  const chartChildren = charts.flatMap((chart, index) => {
    const fitted = fitImageSize(chart.width * 2, chart.height * 2, 880, 500);
    return [
      new Paragraph({
        text: chart.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: index === 0 ? 320 : 560, after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: chart.description, color: '64748B', size: 20 })],
        spacing: { after: 180 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: dataUrlToUint8Array(chart.dataUrl),
            transformation: fitted,
            type: 'png',
          }),
        ],
      }),
    ];
  });

  const doc = new Document({
    creator: 'SOKOL',
    title: documentTitle,
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: documentTitle,
            heading: HeadingLevel.TITLE,
            spacing: { after: 160 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Отчёт по выбранным дашбордам. Графики, подписи и легенды соответствуют экранной версии.',
                color: '64748B',
              }),
            ],
            spacing: { after: 240 },
          }),
          metaTable,
          ...chartChildren,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp()}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function buildVisualHtml(options: {
  documentTitle: string;
  meta: VisualExportMetaRow[];
  charts: DashboardChartCapture[];
  filenamePrefix: string;
}) {
  const { documentTitle, meta, charts, filenamePrefix } = options;
  const metaRows = meta
    .map(
      ([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('');

  const chartSections = charts
    .map((chart, index) => {
      // Prefer validated SVG (+ legend), then real HTML blocks (tables/KPI), else PNG.
      let chartBody: string;
      if (isUsefulSvgMarkup(chart.svgMarkup)) {
        chartBody = `<div class="chart-svg" data-chart-index="${index}">${chart.svgMarkup}</div>`;
      } else if (chart.htmlMarkup) {
        chartBody = chart.htmlMarkup;
      } else {
        chartBody = `<img class="chart-img" src="${chart.dataUrl}" alt="${escapeHtml(chart.title)}" width="${chart.width}" height="${chart.height}" />`;
      }
      return `
      <section class="card" id="chart-${escapeHtml(chart.id)}">
        <header>
          <h2>${escapeHtml(chart.title)}</h2>
          <p>${escapeHtml(chart.description)}</p>
        </header>
        <div class="chart-frame">
          ${chartBody}
        </div>
      </section>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    :root {
      --ink: #1a2332;
      --muted: #5b6b7c;
      --brand: #003366;
      --brand-soft: #e8eef4;
      --line: #d7dee7;
      --bg: #f3f5f7;
      --card: #ffffff;
      --accent: #4f7fa8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background-color: var(--bg);
      background-image:
        linear-gradient(180deg, #e9eef3 0%, var(--bg) 180px);
      line-height: 1.5;
    }
    .page {
      width: min(1080px, calc(100% - 40px));
      margin: 28px auto 56px;
    }
    .hero {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      border-top: 3px solid var(--brand);
      padding: 22px 24px 18px;
      margin-bottom: 14px;
    }
    .hero .brand {
      margin: 0 0 10px;
      color: var(--brand);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .hero h1 {
      margin: 0;
      color: var(--brand);
      font-size: 1.65rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .meta {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 11px 16px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      font-size: 0.92rem;
    }
    th {
      width: 30%;
      color: var(--brand);
      background: var(--brand-soft);
      font-weight: 650;
    }
    tr:last-child th, tr:last-child td { border-bottom: 0; }
    .toc {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 18px;
    }
    .toc a {
      text-decoration: none;
      color: var(--brand);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 11px;
      font-size: 0.82rem;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .toc a:hover {
      border-color: var(--accent);
      background: var(--brand-soft);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px 20px 16px;
      margin-bottom: 14px;
    }
    .card header h2 {
      margin: 0 0 4px;
      color: var(--brand);
      font-size: 1.15rem;
      font-weight: 700;
    }
    .card header p {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .chart-frame {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fafbfc;
      padding: 14px;
      overflow: auto;
    }
    .chart-svg svg, .chart-img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 560px;
      object-fit: contain;
      background: #fff;
      border-radius: 6px;
    }
    .chart-svg svg {
      cursor: crosshair;
      overflow: visible;
    }
    .chart-legend {
      margin-top: 8px;
      display: flex;
      justify-content: center;
    }
    .chart-legend .recharts-legend-wrapper {
      position: static !important;
      width: auto !important;
    }
    .chart-html {
      overflow: auto;
      background: #fff;
      border-radius: 6px;
    }
    .chart-html table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    .chart-html th, .chart-html td {
      border: 1px solid var(--line);
      padding: 6px 8px;
      background: transparent;
      width: auto;
      font-weight: inherit;
    }
    .chart-svg svg .recharts-layer path,
    .chart-svg svg .recharts-layer rect,
    .chart-svg svg .recharts-sector,
    .chart-svg svg .recharts-rectangle {
      transition: opacity 0.15s ease, filter 0.15s ease;
    }
    .chart-svg.is-hovering svg .recharts-layer path,
    .chart-svg.is-hovering svg .recharts-layer rect,
    .chart-svg.is-hovering svg .recharts-sector,
    .chart-svg.is-hovering svg .recharts-rectangle {
      opacity: 0.35;
    }
    .chart-svg.is-hovering svg .recharts-layer path:hover,
    .chart-svg.is-hovering svg .recharts-layer rect:hover,
    .chart-svg.is-hovering svg .recharts-sector:hover,
    .chart-svg.is-hovering svg .recharts-rectangle:hover,
    .chart-svg svg [data-active="true"] {
      opacity: 1 !important;
      filter: brightness(1.05);
    }
    .tooltip {
      position: fixed;
      z-index: 20;
      pointer-events: none;
      display: none;
      min-width: 120px;
      max-width: 280px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(0, 51, 102, 0.94);
      color: #fff;
      font-size: 12px;
    }
    .footnote {
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.82rem;
      text-align: center;
    }
    .to-top {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 30;
      width: 40px;
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card);
      color: var(--brand);
      box-shadow: 0 4px 14px rgba(26, 35, 50, 0.12);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transform: translateY(6px);
      transition: opacity 0.18s ease, visibility 0.18s ease, transform 0.18s ease, background 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      line-height: 1;
      padding: 0;
    }
    .to-top.is-visible {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .to-top:hover {
      background: var(--brand-soft);
    }
    .to-top:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    @media print {
      body { background: #fff; }
      .page { width: 100%; margin: 0; }
      .toc, .to-top { display: none; }
      .card, .meta, .hero { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page" id="top">
    <section class="hero">
      <p class="brand">SOKOL</p>
      <h1>${escapeHtml(documentTitle)}</h1>
    </section>
    <section class="meta">
      <table>
        <tbody>${metaRows}</tbody>
      </table>
    </section>
    <nav class="toc">
      ${charts
        .map((chart) => `<a href="#chart-${escapeHtml(chart.id)}">${escapeHtml(chart.title)}</a>`)
        .join('')}
    </nav>
    ${chartSections}
    <p class="footnote">SOKOL: Сформировано ${escapeHtml(new Date().toLocaleString('ru-RU'))}</p>
  </div>
  <button type="button" class="to-top" id="to-top" aria-label="Наверх" title="Наверх">↑</button>
  <div class="tooltip" id="chart-tooltip"></div>
  <script>
    (function () {
      var toTop = document.getElementById('to-top');
      if (toTop) {
        var toggleToTop = function () {
          if (window.scrollY > 280) toTop.classList.add('is-visible');
          else toTop.classList.remove('is-visible');
        };
        window.addEventListener('scroll', toggleToTop, { passive: true });
        toggleToTop();
        toTop.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      var tooltip = document.getElementById('chart-tooltip');
      document.querySelectorAll('.chart-svg').forEach(function (frame) {
        frame.addEventListener('pointerover', function (event) {
          var target = event.target;
          if (!target || !target.closest) return;
          var hit = target.closest('path, rect, circle, polygon, polyline, .recharts-sector, .recharts-rectangle');
          if (!hit || !frame.contains(hit)) return;
          frame.classList.add('is-hovering');
          frame.querySelectorAll('[data-active="true"]').forEach(function (node) {
            node.removeAttribute('data-active');
          });
          hit.setAttribute('data-active', 'true');
          var label =
            hit.getAttribute('data-label') ||
            hit.getAttribute('name') ||
            hit.getAttribute('aria-label') ||
            hit.getAttribute('data-name') ||
            hit.getAttribute('title');
          if (!label) {
            var group = hit.closest('g');
            if (group) {
              var texts = [];
              group.querySelectorAll(':scope > text').forEach(function (node) {
                var value = (node.textContent || '').trim();
                if (value) texts.push(value);
              });
              if (texts.length) label = texts.join(' · ');
            }
          }
          tooltip.textContent = label || 'Значение графика';
          tooltip.style.display = 'block';
        });
        frame.addEventListener('pointermove', function (event) {
          if (tooltip.style.display === 'none') return;
          tooltip.style.left = event.clientX + 14 + 'px';
          tooltip.style.top = event.clientY + 14 + 'px';
        });
        frame.addEventListener('pointerleave', function () {
          frame.classList.remove('is-hovering');
          frame.querySelectorAll('[data-active="true"]').forEach(function (node) {
            node.removeAttribute('data-active');
          });
          tooltip.style.display = 'none';
        });
      });
    })();
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp()}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportVisualAnalyticsReport(options: {
  format: 'xlsx' | 'pdf' | 'docx' | 'html';
  kind: VisualAnalyticsKind;
  documentTitle: string;
  filenamePrefix: string;
  meta: VisualExportMetaRow[];
  selectedSections: string[];
}) {
  const charts = await captureDashboardCharts(options.selectedSections);
  if (charts.length === 0) {
    throw new Error(
      'Не удалось снять выбранные дашборды. Отметьте карточки с графиками (не только «Исходные данные») и убедитесь, что они видны на экране.',
    );
  }

  if (options.format === 'pdf') {
    await buildVisualPdf({
      documentTitle: options.documentTitle,
      meta: options.meta,
      charts,
      filenamePrefix: options.filenamePrefix,
    });
    return;
  }

  if (options.format === 'docx') {
    await buildVisualDocx({
      documentTitle: options.documentTitle,
      meta: options.meta,
      charts,
      filenamePrefix: options.filenamePrefix,
    });
    return;
  }

  if (options.format === 'html') {
    await buildVisualHtml({
      documentTitle: options.documentTitle,
      meta: options.meta,
      charts,
      filenamePrefix: options.filenamePrefix,
    });
    return;
  }

  await buildVisualXlsx({
    documentTitle: options.documentTitle,
    meta: options.meta,
    charts,
    kind: options.kind,
    filenamePrefix: options.filenamePrefix,
  });
}
