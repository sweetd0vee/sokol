import * as XLSX from 'xlsx-js-style';
import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import {
  AlignmentType,
  BorderStyle,
  Document,
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
import { getCheckStatusLabel, getCheckTypeLabel } from '../constants/checks';
import type { Recommendation } from '../types/recommendation';
import {
  getIndicatorLabel,
  getMaterialityLevelLabel,
  getRecommendationAdditionalStatusLabel,
  getRecommendationStatusLabel,
} from '../constants/recommendations';
import { downloadBlob } from './download';

pdfMake.addVirtualFileSystem(pdfFonts);

export const EXPORT_FORMATS = [
  { value: 'xlsx', label: 'XLSX' },
  { value: 'docx', label: 'DOCX' },
  { value: 'pdf', label: 'PDF' },
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
const MATERIALITY_FILLS: Record<string, string> = {
  Высокий: 'FECACA',
  Средний: 'FEF08A',
  Низкий: 'BBF7D0',
};
const INDICATOR_FILLS: Record<string, string> = {
  'В процессе': 'FEF9C3',
  Ожидает: 'E5E7EB',
  'Не решено': 'FECACA',
  Исполнено: 'DCFCE7',
};

const CHECK_COLUMN_KEYS = [
  'ID',
  'Ключ',
  'Название проверки',
  'Тип проверки',
  'Дата начала',
  'Руководитель проверки',
  'Статус',
] as const;

const RECOMMENDATION_TABLE_COLUMN_KEYS = [
  'ID',
  'Ключ',
  'Название',
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

function getMaterialityFill(value: unknown) {
  return MATERIALITY_FILLS[toCellText(value)];
}

function getIndicatorFill(value: unknown) {
  return INDICATOR_FILLS[toCellText(value)];
}

function getHighlightFill(header: string | undefined, value: unknown) {
  if (header === 'Статус') {
    return getStatusFill(value);
  }
  if (header === 'Дополнительный статус') {
    return getAdditionalStatusFill(value);
  }
  if (header === 'Уровень существенности') {
    return getMaterialityFill(value);
  }
  if (header === 'Индикатор') {
    return getIndicatorFill(value);
  }
  return undefined;
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
        border: {
          top: { style: 'thin', color: { rgb: BORDER_GRAY } },
          bottom: { style: 'thin', color: { rgb: BORDER_GRAY } },
          left: { style: 'thin', color: { rgb: BORDER_GRAY } },
          right: { style: 'thin', color: { rgb: BORDER_GRAY } },
        },
      };
    }
  }
  ws['!cols'] = headers.map((header) => {
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

async function exportRowsDocx(
  rows: ExportRow[],
  headers: string[],
  title: string,
  filename: string
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
          children: headers.map((header) =>
            createDocxCell(
              toCellText(row[header]),
              false,
              columnWidth,
              getHighlightFill(header, row[header])
            )
          ),
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
    Название: '*',
    'Объект аудита': '*',
    'Срок исполнения': 48,
    Индикатор: 42,
    'Уровень существенности': 54,
    Аудитор: 40,
    'Руководитель объекта аудита': 70,
    Статус: 40,
    'Дополнительный статус': 54,
    'Название проверки': '*',
    'Тип проверки': 55,
    'Дата начала': 48,
    'Руководитель проверки': 70,
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

function exportRowsPdf(rows: ExportRow[], headers: string[], title: string, filename: string) {
  const isWideTable = headers.length >= 8;
  const body = [
    headers.map((header) => ({
      text: header,
      style: 'tableHeader',
      fillColor: `#${HEADER_BLUE}`,
    })),
    ...rows.map((row) =>
      headers.map((header) => {
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

function toCheckRows(checks: Check[]): ExportRow[] {
  return checks.map((check) => ({
    ID: check.id,
    Ключ: check.serial_number ?? '',
    'Название проверки': check.check_name ?? '',
    'Тип проверки': getCheckTypeLabel(check.check_type),
    'Дата начала': formatCheckDate(check.start_date),
    'Руководитель проверки': check.check_leader ?? '',
    Статус: getCheckStatusLabel(check.status),
  }));
}

function toRecommendationTableRows(recommendations: Recommendation[]): ExportRow[] {
  return recommendations.map((recommendation) => ({
    ID: recommendation.id,
    Ключ: recommendation.serial_number,
    Название: recommendation.name,
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


function exportChecksXlsx(checks: Check[], filename: string) {
  const rows = toCheckRows(checks);
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetTableStyle(ws, getHeaders(rows, CHECK_COLUMN_KEYS), rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Проверки');
  XLSX.writeFile(wb, filename);
}

async function exportChecksDocx(checks: Check[], filename: string) {
  const rows = toCheckRows(checks);
  await exportRowsDocx(rows, getHeaders(rows, CHECK_COLUMN_KEYS), 'Проверки — Сокол', filename);
}

function exportChecksPdf(checks: Check[], filename: string) {
  const rows = toCheckRows(checks);
  exportRowsPdf(rows, getHeaders(rows, CHECK_COLUMN_KEYS), 'Проверки — Сокол', filename);
}

function exportRecommendationsTableXlsx(recommendations: Recommendation[], filename: string) {
  const rows = toRecommendationTableRows(recommendations);
  const ws = XLSX.utils.json_to_sheet(rows);
  applySheetTableStyle(ws, getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS), rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Рекомендации');
  XLSX.writeFile(wb, filename);
}

async function exportRecommendationsTableDocx(recommendations: Recommendation[], filename: string) {
  const rows = toRecommendationTableRows(recommendations);
  await exportRowsDocx(rows, getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS), 'Рекомендации — Сокол', filename);
}

function exportRecommendationsTablePdf(recommendations: Recommendation[], filename: string) {
  const rows = toRecommendationTableRows(recommendations);
  exportRowsPdf(rows, getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS), 'Рекомендации — Сокол', filename);
}

export async function exportChecks(
  checks: Check[],
  format: ExportFormat,
  filenameBase: string
) {
  const filename = `${filenameBase}.${format}`;
  switch (format) {
    case 'xlsx':
      exportChecksXlsx(checks, filename);
      break;
    case 'docx':
      await exportChecksDocx(checks, filename);
      break;
    case 'pdf':
      exportChecksPdf(checks, filename);
      break;
  }
}

export async function exportRecommendationsTable(
  recommendations: Recommendation[],
  format: ExportFormat,
  filenameBase: string
) {
  const filename = `${filenameBase}.${format}`;
  switch (format) {
    case 'xlsx':
      exportRecommendationsTableXlsx(recommendations, filename);
      break;
    case 'docx':
      await exportRecommendationsTableDocx(recommendations, filename);
      break;
    case 'pdf':
      exportRecommendationsTablePdf(recommendations, filename);
      break;
  }
}
