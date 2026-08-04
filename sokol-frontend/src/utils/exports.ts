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
import { getCheckStatusLabel, getCheckTypeLabel } from '../constants/checks';
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
  'Дата начала',
  'Руководитель проверки',
  'Статус',
] as const;

const RECOMMENDATION_TABLE_COLUMN_KEYS = [
  'ID',
  'Ключ',
  'Название проверки',
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
    Название: '*',
    'Объект аудита': '*',
    'Срок исполнения': 48,
    Индикатор: 28,
    'Уровень существенности': 28,
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
  }
}
