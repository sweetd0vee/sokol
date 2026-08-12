import * as XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Check } from '../types/check';
import { getCheckStatusLabel, getCheckTypeLabel, getCheckViewLabel } from '../constants/checks';
import { buildCheckYearlyNumbers } from './checkYearlyNumber';
import type { Recommendation } from '../types/recommendation';
import {
  getIndicatorLabel,
  getMaterialityLevelLabel,
  getRecommendationAdditionalStatusLabel,
  getRecommendationStatusLabel,
} from '../constants/recommendations';
import { downloadBlob } from './download';
import {
  indicatorIconBytesToDataUrl,
  preloadIndicatorIcons,
} from './exportIndicatorIcons';

pdfMake.addVirtualFileSystem(pdfFonts);

export const EXPORT_FORMATS = [
  { value: 'xlsx', label: 'XLSX' },
  { value: 'docx', label: 'DOCX' },
  { value: 'pdf', label: 'PDF' },
  { value: 'html', label: 'HTML' },
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number]['value'];

type ExportRow = Record<string, unknown>;

const HEADER_BLUE = '003366';
const LIGHT_ROW_FILL = 'F8FAFC';
const BORDER_GRAY = 'D1D5DB';
const WHITE = 'FFFFFF';
const CHECK_STATUS_FILLS: Record<string, string> = {
  Запланировано: 'E5E7EB',
  'В процессе': 'FEF9C3',
  Завершено: 'DCFCE7',
};
const RECOMMENDATION_STATUS_FILLS: Record<string, string> = {
  Исполнено: 'DCFCE7',
  'Не решено': 'FECACA',
  'На контроле': 'E5E7EB',
  'В процессе': 'FEF9C3',
};
const RECOMMENDATION_ADDITIONAL_STATUS_FILLS: Record<string, string> = {
  'В срок': 'DCFCE7',
  'Срок нарушен': 'FECACA',
  'На контроле': 'E5E7EB',
};
/** Dot colors matching the recommendations table UI. */
const MATERIALITY_DOT_COLORS: Record<string, string> = {
  Высокий: 'FF4347',
  Средний: 'FBEB8D',
  Низкий: 'A7F7C2',
};
const MATERIALITY_DOT_CHAR = '●';
const INDICATOR_ICON_DISPLAY_PX = 14;

const CHECK_COLUMN_KEYS = [
  'ID',
  'Ключ',
  'Название проверки',
  'Тип проверки',
  'Вид',
  'Дата начала',
  'Руководитель проверки',
  'Статус',
] as const;

const RECOMMENDATION_TABLE_COLUMN_KEYS = [
  'ID',
  'Ключ',
  'Название проверки',
  'Название рекомендации',
  'Название наблюдения',
  'Объект аудита',
  'Индикатор',
  'Срок исполнения',
  'Уровень существенности',
  'Аудитор',
  'Руководитель объекта аудита',
  'Статус',
  'Дополнительный статус',
] as const;

const TIMES_NEW_ROMAN_12 = { name: 'Times New Roman', sz: 12 };

function getHeaders(rows: ExportRow[], fallbackHeaders: readonly string[]) {
  return rows.length > 0 ? Object.keys(rows[0]!) : [...fallbackHeaders];
}

function toCellText(value: unknown) {
  return String(value ?? '');
}

function getStatusFill(value: unknown) {
  const text = toCellText(value);
  return RECOMMENDATION_STATUS_FILLS[text] ?? CHECK_STATUS_FILLS[text];
}

function getAdditionalStatusFill(value: unknown) {
  return RECOMMENDATION_ADDITIONAL_STATUS_FILLS[toCellText(value)];
}

function getMaterialityDotColor(value: unknown) {
  return MATERIALITY_DOT_COLORS[toCellText(value)];
}

function isMaterialityHeader(header: string | undefined) {
  return header === 'Уровень существенности';
}

function isIndicatorHeader(header: string | undefined) {
  return header === 'Индикатор';
}

function getHighlightFill(header: string | undefined, value: unknown) {
  if (header === 'Статус') {
    return getStatusFill(value);
  }
  if (header === 'Дополнительный статус') {
    return getAdditionalStatusFill(value);
  }
  return undefined;
}

function getCellBorderStyle() {
  return {
    top: { style: 'thin' as const, color: { rgb: BORDER_GRAY } },
    bottom: { style: 'thin' as const, color: { rgb: BORDER_GRAY } },
    left: { style: 'thin' as const, color: { rgb: BORDER_GRAY } },
    right: { style: 'thin' as const, color: { rgb: BORDER_GRAY } },
  };
}

function applySheetTableStyle(ws: XLSX.WorkSheet, headers: string[], rows: ExportRow[]) {
  const ref = ws['!ref'];
  if (!ref) {
    return;
  }
  const range = XLSX.utils.decode_range(ref);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellAddress];
      if (!cell) {
        continue;
      }
      const isHeader = row === range.s.r;
      const header = headers[col - range.s.c];
      const materialityColor =
        !isHeader && isMaterialityHeader(header) ? getMaterialityDotColor(cell.v) : undefined;

      if (materialityColor) {
        cell.v = MATERIALITY_DOT_CHAR;
        cell.t = 's';
        cell.w = MATERIALITY_DOT_CHAR;
        cell.s = {
          ...(cell.s ?? {}),
          font: {
            name: 'Segoe UI Symbol',
            sz: 16,
            color: { rgb: materialityColor },
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
          },
          border: getCellBorderStyle(),
        };
        continue;
      }

      if (!isHeader && isIndicatorHeader(header)) {
        // Recommendation XLSX uses ExcelJS with embedded icon images instead.
        cell.v = '';
        cell.t = 's';
        cell.s = {
          ...(cell.s ?? {}),
          alignment: { horizontal: 'center', vertical: 'center' },
          border: getCellBorderStyle(),
        };
        continue;
      }

      const valueFill = !isHeader ? getHighlightFill(header, cell.v) : undefined;
      cell.s = {
        ...(cell.s ?? {}),
        font: {
          ...TIMES_NEW_ROMAN_12,
          bold: isHeader,
          color: isHeader ? { rgb: WHITE } : { rgb: '111827' },
        },
        fill: isHeader
          ? { fgColor: { rgb: HEADER_BLUE } }
          : valueFill
            ? { fgColor: { rgb: valueFill } }
            : undefined,
        alignment: {
          horizontal: isHeader || valueFill ? 'center' : 'left',
          vertical: 'center',
          wrapText: true,
        },
        border: getCellBorderStyle(),
      };
    }
  }
  ws['!cols'] = headers.map((header) => {
    if (isMaterialityHeader(header) || isIndicatorHeader(header)) {
      return { wch: 14 };
    }
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => toCellText(row[header]).length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 12), 42) };
  });
}

function createDocxCell(text: string, isHeader: boolean, width: number, fillColor?: string) {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: isHeader || fillColor ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: isHeader,
            color: isHeader ? WHITE : '111827',
          }),
        ],
      }),
    ],
    shading:
      isHeader || fillColor
        ? {
            type: ShadingType.CLEAR,
            fill: isHeader ? HEADER_BLUE : fillColor,
            color: 'auto',
          }
        : undefined,
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: {
      top: 120,
      bottom: 120,
      left: 120,
      right: 120,
    },
  });
}

function createDocxMaterialityCell(label: string, width: number) {
  const color = getMaterialityDotColor(label) ?? '9CA3AF';
  return new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: MATERIALITY_DOT_CHAR,
            color,
            size: 28,
            font: 'Segoe UI Symbol',
          }),
        ],
      }),
    ],
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: {
      top: 120,
      bottom: 120,
      left: 120,
      right: 120,
    },
  });
}

function createDocxIndicatorCell(icon: Uint8Array | undefined, width: number) {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: icon
          ? [
              new ImageRun({
                type: 'png',
                data: icon,
                transformation: {
                  width: INDICATOR_ICON_DISPLAY_PX,
                  height: INDICATOR_ICON_DISPLAY_PX,
                },
              }),
            ]
          : [],
      }),
    ],
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: {
      top: 80,
      bottom: 80,
      left: 80,
      right: 80,
    },
  });
}

async function exportRowsDocx(
  rows: ExportRow[],
  headers: string[],
  title: string,
  filename: string,
  indicatorIcons?: Map<string, Uint8Array>
) {
  const columnWidth = Math.floor(100 / Math.max(headers.length, 1));
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((header) => createDocxCell(header, true, columnWidth)),
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: headers.map((header) => {
            if (isMaterialityHeader(header)) {
              return createDocxMaterialityCell(toCellText(row[header]), columnWidth);
            }
            if (isIndicatorHeader(header)) {
              return createDocxIndicatorCell(
                indicatorIcons?.get(toCellText(row[header])),
                columnWidth
              );
            }
            return createDocxCell(
              toCellText(row[header]),
              false,
              columnWidth,
              getHighlightFill(header, row[header])
            );
          }),
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: 'Heading1',
            spacing: { after: 400 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
              left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
              right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
            },
            rows: tableRows,
          }),
        ],
      },
    ],
  });

  downloadBlob(await Packer.toBlob(doc), filename);
}

function getPdfColumnWidths(headers: string[]): Array<number | '*'> {
  const widthByHeader: Record<string, number | '*'> = {
    ID: 18,
    Ключ: 42,
    'Название рекомендации': '*',
    'Название наблюдения': '*',
    'Объект аудита': '*',
    'Срок исполнения': 48,
    Индикатор: 28,
    'Уровень существенности': 28,
    Аудитор: 40,
    'Руководитель объекта аудита': 70,
    Статус: 40,
    'Дополнительный статус': 54,
    'Название проверки': '*',
    'Тип проверки': 48,
    Вид: 44,
    'Дата начала': 44,
    'Руководитель проверки': 62,
  };
  return headers.map((header) => widthByHeader[header] ?? '*');
}

function getPdfFontSize(columnCount: number) {
  if (columnCount >= 10) {
    return 6.5;
  }
  if (columnCount >= 8) {
    return 7.5;
  }
  return 9;
}

function exportRowsPdf(
  rows: ExportRow[],
  headers: string[],
  title: string,
  filename: string,
  indicatorIcons?: Map<string, Uint8Array>
) {
  const isWideTable = headers.length >= 8;
  const pdfImages: Record<string, string> = {};
  indicatorIcons?.forEach((bytes, label) => {
    pdfImages[`indicator_${label}`] = indicatorIconBytesToDataUrl(bytes);
  });

  const body = [
    headers.map((header) => ({
      text: header,
      style: 'tableHeader',
      fillColor: `#${HEADER_BLUE}`,
    })),
    ...rows.map((row) =>
      headers.map((header) => {
        if (isMaterialityHeader(header)) {
          const color = getMaterialityDotColor(row[header]) ?? '9CA3AF';
          const radius = 5;
          const diameter = radius * 2;
          return {
            columns: [
              { width: '*', text: '' },
              {
                width: diameter,
                canvas: [
                  {
                    type: 'ellipse',
                    x: radius,
                    y: radius,
                    r1: radius,
                    r2: radius,
                    color: `#${color}`,
                  },
                ],
              },
              { width: '*', text: '' },
            ],
            margin: [0, 1, 0, 1],
          };
        }
        if (isIndicatorHeader(header)) {
          const label = toCellText(row[header]);
          const imageKey = `indicator_${label}`;
          if (pdfImages[imageKey]) {
            return {
              image: imageKey,
              width: INDICATOR_ICON_DISPLAY_PX,
              height: INDICATOR_ICON_DISPLAY_PX,
              alignment: 'center',
              margin: [0, 1, 0, 1],
            };
          }
          return { text: '', alignment: 'center' };
        }
        const fill = getHighlightFill(header, row[header]);
        return {
          text: toCellText(row[header]),
          style: 'tableCell',
          alignment: fill ? 'center' : 'left',
          ...(fill ? { fillColor: `#${fill}` } : {}),
        };
      })
    ),
  ];

  const content = [
    {
      text: title,
      style: 'title',
      margin: [0, 0, 0, isWideTable ? 8 : 12],
    } as Content,
    {
      table: {
        headerRows: 1,
        widths: getPdfColumnWidths(headers),
        body,
        dontBreakRows: true,
      },
      layout: {
        fillColor: (rowIndex: number, node: { table: { body: unknown[][] } }, columnIndex: number) => {
          const cell = node.table.body[rowIndex]?.[columnIndex] as
            | { fillColor?: string }
            | undefined;
          if (cell?.fillColor) {
            return cell.fillColor;
          }
          if (rowIndex === 0) {
            return `#${HEADER_BLUE}`;
          }
          return rowIndex % 2 === 0 ? `#${LIGHT_ROW_FILL}` : null;
        },
        hLineColor: () => `#${BORDER_GRAY}`,
        vLineColor: () => `#${BORDER_GRAY}`,
        paddingLeft: () => (isWideTable ? 2 : 4),
        paddingRight: () => (isWideTable ? 2 : 4),
        paddingTop: () => (isWideTable ? 2 : 4),
        paddingBottom: () => (isWideTable ? 2 : 4),
      },
    } as Content,
  ] as Content[];

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: isWideTable ? [10, 12, 10, 12] : [24, 24, 24, 24],
    defaultStyle: {
      font: 'Roboto',
      fontSize: getPdfFontSize(headers.length),
    },
    images: pdfImages,
    styles: {
      title: {
        fontSize: isWideTable ? 12 : 16,
        bold: true,
        color: `#${HEADER_BLUE}`,
      },
      tableHeader: {
        bold: true,
        color: `#${WHITE}`,
        alignment: 'center',
        fontSize: getPdfFontSize(headers.length),
      },
      tableCell: {
        color: '#111827',
        alignment: 'left',
        fontSize: getPdfFontSize(headers.length),
      },
    },
    content,
  };

  pdfMake.createPdf(docDefinition).download(filename);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlCellContent(
  header: string,
  value: unknown,
  indicatorIcons?: Map<string, Uint8Array>,
) {
  if (isMaterialityHeader(header)) {
    const color = getMaterialityDotColor(value) ?? '9CA3AF';
    return `<span style="color:#${color};font-size:18px;line-height:1">${MATERIALITY_DOT_CHAR}</span>`;
  }
  if (isIndicatorHeader(header)) {
    const label = toCellText(value);
    const icon = indicatorIcons?.get(label);
    if (icon) {
      return `<img src="${indicatorIconBytesToDataUrl(icon)}" alt="${escapeHtml(label)}" width="${INDICATOR_ICON_DISPLAY_PX}" height="${INDICATOR_ICON_DISPLAY_PX}" style="display:block;margin:0 auto" />`;
    }
    return '';
  }
  return escapeHtml(toCellText(value));
}

function buildHtmlCellStyle(header: string, value: unknown) {
  const parts: string[] = [];
  const fill = getHighlightFill(header, value);
  if (fill) {
    parts.push(`background-color:#${fill}`, 'text-align:center');
  } else if (isMaterialityHeader(header) || isIndicatorHeader(header)) {
    parts.push('text-align:center');
  }
  if (isHtmlNoWrapHeader(header)) {
    parts.push('white-space:nowrap', 'word-break:normal');
  }
  return parts.length > 0 ? `${parts.join(';')};` : '';
}

const HTML_NO_WRAP_HEADERS = new Set([
  'ID',
  'Ключ',
  'Срок исполнения',
  'Дата начала',
  'Аудитор',
  'Руководитель объекта аудита',
  'Руководитель проверки',
  'Статус',
  'Дополнительный статус',
]);

function isHtmlNoWrapHeader(header: string | undefined) {
  return header !== undefined && HTML_NO_WRAP_HEADERS.has(header);
}

function exportRowsHtml(
  rows: ExportRow[],
  headers: string[],
  title: string,
  filename: string,
  indicatorIcons?: Map<string, Uint8Array>,
) {
  const headerCells = headers
    .map((header) => `<th scope="col">${escapeHtml(header)}</th>`)
    .join('');
  const bodyRows = rows
    .map((row, rowIndex) => {
      const rowFill = rowIndex % 2 === 1 ? `background-color:#${LIGHT_ROW_FILL};` : '';
      const cells = headers
        .map((header) => {
          const value = row[header];
          const style = [rowFill, buildHtmlCellStyle(header, value)].filter(Boolean).join('');
          const nowrapClass = isHtmlNoWrapHeader(header) ? ' class="nowrap"' : '';
          return `<td${nowrapClass}${style ? ` style="${style}"` : ''}>${buildHtmlCellContent(header, value, indicatorIcons)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --brand: #003366;
      --line: #d1d5db;
      --ink: #111827;
      --muted: #5b6b7c;
      --bg: #f3f5f7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Times New Roman", "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.45;
    }
    .page {
      width: min(1400px, calc(100% - 32px));
      margin: 24px auto 48px;
    }
    .hero {
      background: #fff;
      border: 1px solid var(--line);
      border-top: 3px solid var(--brand);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 16px;
    }
    .hero h1 {
      margin: 0;
      color: var(--brand);
      font-size: 1.5rem;
      font-weight: 700;
    }
    .hero p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .table-wrap {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #${HEADER_BLUE};
      color: #fff;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      padding: 10px 12px;
      border: 1px solid var(--line);
      white-space: nowrap;
    }
    tbody td {
      padding: 8px 12px;
      border: 1px solid var(--line);
      vertical-align: middle;
      word-break: break-word;
    }
    tbody td.nowrap {
      white-space: nowrap;
      word-break: normal;
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <h1>${escapeHtml(title)}</h1>
      <p>Сформировано: ${escapeHtml(new Date().toLocaleString('ru-RU'))} · Записей: ${rows.length}</p>
    </header>
    <div class="table-wrap">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
}

function formatCheckDate(value?: string) {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.split('-').map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day).toLocaleDateString('ru-RU');
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU');
}

function toCheckRows(checks: Check[], yearlyNumbers: Map<string, number>): ExportRow[] {
  return checks.map((check) => ({
    ID: yearlyNumbers.get(check.id) ?? '',
    Ключ: check.serial_number ?? '',
    'Название проверки': check.check_name ?? '',
    'Тип проверки': getCheckTypeLabel(check.check_type),
    Вид: getCheckViewLabel(check.check_view),
    'Дата начала': formatCheckDate(check.start_date),
    'Руководитель проверки': check.check_leader ?? '',
    Статус: getCheckStatusLabel(check.status),
  }));
}

function toRecommendationTableRows(
  recommendations: Recommendation[],
  checks: Check[],
): ExportRow[] {
  const checkNameByKey = new Map(
    checks.map((check) => [check.serial_number, check.check_name?.trim() ?? ''] as const),
  );

  return recommendations.map((recommendation) => ({
    ID: recommendation.id,
    Ключ: recommendation.serial_number,
    'Название проверки': checkNameByKey.get(recommendation.serial_number) ?? '',
    'Название рекомендации': recommendation.name,
    'Название наблюдения': recommendation.observation_name ?? '',
    'Объект аудита': recommendation.audit_object,
    Индикатор: getIndicatorLabel(recommendation.indicator),
    'Срок исполнения': formatCheckDate(recommendation.deadline),
    'Уровень существенности': getMaterialityLevelLabel(recommendation.materiality_level),
    Аудитор: recommendation.auditor,
    'Руководитель объекта аудита': recommendation.manager,
    Статус: getRecommendationStatusLabel(recommendation.status),
    'Дополнительный статус': getRecommendationAdditionalStatusLabel(recommendation.additional_status),
  }));
}


function exportChecksXlsx(checks: Check[], filename: string, yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetTableStyle(ws, getHeaders(rows, CHECK_COLUMN_KEYS), rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Проверки');
  XLSX.writeFile(wb, filename);
}

async function exportChecksDocx(checks: Check[], filename: string, yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  await exportRowsDocx(rows, getHeaders(rows, CHECK_COLUMN_KEYS), 'Проверки — Сокол', filename);
}

function exportChecksPdf(checks: Check[], filename: string, yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  exportRowsPdf(rows, getHeaders(rows, CHECK_COLUMN_KEYS), 'Проверки — Сокол', filename);
}

function exportChecksHtml(checks: Check[], filename: string, yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  exportRowsHtml(rows, getHeaders(rows, CHECK_COLUMN_KEYS), 'Проверки — Сокол', filename);
}

function excelBorder() {
  const edge = { style: 'thin' as const, color: { argb: `FF${BORDER_GRAY}` } };
  return { top: edge, bottom: edge, left: edge, right: edge };
}

async function exportRecommendationsTableXlsx(
  recommendations: Recommendation[],
  checks: Check[],
  filename: string,
) {
  const rows = toRecommendationTableRows(recommendations, checks);
  const headers = getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS);
  const indicatorIcons = await preloadIndicatorIcons(rows.map((row) => toCellText(row.Индикатор)));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Рекомендации');
  const headerRow = sheet.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: `FF${WHITE}` } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${HEADER_BLUE}` },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = excelBorder();
  });

  const indicatorColIndex = headers.indexOf('Индикатор');
  const iconIds = new Map<string, number>();
  indicatorIcons.forEach((bytes, label) => {
    iconIds.set(
      label,
      workbook.addImage({
        base64: indicatorIconBytesToDataUrl(bytes).split(',')[1] ?? '',
        extension: 'png',
      })
    );
  });

  rows.forEach((row, rowOffset) => {
    const values = headers.map((header) => {
      if (isIndicatorHeader(header)) {
        return '';
      }
      if (isMaterialityHeader(header)) {
        return MATERIALITY_DOT_CHAR;
      }
      return toCellText(row[header]);
    });
    const excelRow = sheet.addRow(values);
    excelRow.height = 20;
    excelRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      const rawValue = row[header ?? ''];
      const fill = getHighlightFill(header, rawValue);
      const isMateriality = isMaterialityHeader(header);
      const isIndicator = isIndicatorHeader(header);

      cell.border = excelBorder();
      cell.alignment = {
        horizontal: fill || isMateriality || isIndicator ? 'center' : 'left',
        vertical: 'middle',
        wrapText: !isMateriality && !isIndicator,
      };

      if (isMateriality) {
        cell.font = {
          name: 'Segoe UI Symbol',
          size: 16,
          color: { argb: `FF${getMaterialityDotColor(rawValue) ?? '9CA3AF'}` },
        };
        return;
      }

      if (isIndicator) {
        cell.font = { name: 'Times New Roman', size: 12, color: { argb: 'FF111827' } };
        return;
      }

      cell.font = {
        name: 'Times New Roman',
        size: 12,
        color: { argb: 'FF111827' },
      };
      if (fill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${fill}` },
        };
      }
    });

    if (indicatorColIndex >= 0) {
      const label = toCellText(row.Индикатор);
      const imageId = iconIds.get(label);
      if (imageId !== undefined) {
        sheet.addImage(imageId, {
          tl: { col: indicatorColIndex + 0.35, row: rowOffset + 1.2 },
          ext: { width: INDICATOR_ICON_DISPLAY_PX, height: INDICATOR_ICON_DISPLAY_PX },
          editAs: 'oneCell',
        });
      }
    }
  });

  headers.forEach((header, index) => {
    if (isMaterialityHeader(header) || isIndicatorHeader(header)) {
      sheet.getColumn(index + 1).width = 14;
      return;
    }
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => toCellText(row[header]).length)
    );
    sheet.getColumn(index + 1).width = Math.min(Math.max(maxLength + 2, 12), 42);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename
  );
}

async function exportRecommendationsTableDocx(
  recommendations: Recommendation[],
  checks: Check[],
  filename: string,
) {
  const rows = toRecommendationTableRows(recommendations, checks);
  const indicatorIcons = await preloadIndicatorIcons(rows.map((row) => toCellText(row.Индикатор)));
  await exportRowsDocx(
    rows,
    getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS),
    'Рекомендации — Сокол',
    filename,
    indicatorIcons
  );
}

async function exportRecommendationsTablePdf(
  recommendations: Recommendation[],
  checks: Check[],
  filename: string,
) {
  const rows = toRecommendationTableRows(recommendations, checks);
  const indicatorIcons = await preloadIndicatorIcons(rows.map((row) => toCellText(row.Индикатор)));
  exportRowsPdf(
    rows,
    getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS),
    'Рекомендации — Сокол',
    filename,
    indicatorIcons
  );
}

async function exportRecommendationsTableHtml(
  recommendations: Recommendation[],
  checks: Check[],
  filename: string,
) {
  const rows = toRecommendationTableRows(recommendations, checks);
  const indicatorIcons = await preloadIndicatorIcons(rows.map((row) => toCellText(row.Индикатор)));
  exportRowsHtml(
    rows,
    getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS),
    'Рекомендации — Сокол',
    filename,
    indicatorIcons
  );
}

export async function exportChecks(
  checks: Check[],
  format: ExportFormat,
  filenameBase: string,
  allChecksForNumbering: Check[] = checks,
) {
  const yearlyNumbers = buildCheckYearlyNumbers(allChecksForNumbering);
  const filename = `${filenameBase}.${format}`;
  switch (format) {
    case 'xlsx':
      exportChecksXlsx(checks, filename, yearlyNumbers);
      break;
    case 'docx':
      await exportChecksDocx(checks, filename, yearlyNumbers);
      break;
    case 'pdf':
      exportChecksPdf(checks, filename, yearlyNumbers);
      break;
    case 'html':
      exportChecksHtml(checks, filename, yearlyNumbers);
      break;
  }
}

export async function exportRecommendationsTable(
  recommendations: Recommendation[],
  checks: Check[],
  format: ExportFormat,
  filenameBase: string
) {
  const filename = `${filenameBase}.${format}`;
  switch (format) {
    case 'xlsx':
      await exportRecommendationsTableXlsx(recommendations, checks, filename);
      break;
    case 'docx':
      await exportRecommendationsTableDocx(recommendations, checks, filename);
      break;
    case 'pdf':
      await exportRecommendationsTablePdf(recommendations, checks, filename);
      break;
    case 'html':
      await exportRecommendationsTableHtml(recommendations, checks, filename);
      break;
  }
}
