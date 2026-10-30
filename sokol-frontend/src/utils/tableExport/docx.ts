import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { downloadBlob } from '../download';
import { preloadIndicatorIcons } from '../exportIndicatorIcons';
import {
  BORDER_GRAY,
  CHECK_COLUMN_KEYS,
  DOCX_COMPACT_CELL_MARGIN_TWIPS,
  DOCX_DEFAULT_CELL_MARGIN_TWIPS,
  DOCX_LANDSCAPE_MARGIN_TWIPS,
  DOCX_LANDSCAPE_PAGE_HEIGHT_TWIPS,
  DOCX_LANDSCAPE_PAGE_WIDTH_TWIPS,
  getHeaders,
  getHighlightFill,
  getMaterialityDotColor,
  HEADER_BLUE,
  INDICATOR_ICON_DISPLAY_PX,
  isIndicatorHeader,
  isMaterialityHeader,
  MATERIALITY_DOT_CHAR,
  RECOMMENDATION_TABLE_COLUMN_KEYS,
  toCellText,
  toCheckRows,
  toRecommendationTableRows,
  WHITE,
} from './shared';
import type { ExportRow } from './types';

export function getDocxFontSize(columnCount: number) {
  if (columnCount >= 10) {
    return 14;
  }
  if (columnCount >= 8) {
    return 16;
  }
  return 20;
}

export type DocxTableOptions = {
  fontSize: number;
  cellMargin: number;
};

export function createDocxCell(
  text: string,
  isHeader: boolean,
  width: number,
  options: DocxTableOptions,
  fillColor?: string
) {
  const lines = text.length ? text.split(/\r?\n/) : [''];
  return new TableCell({
    children: lines.map(
      (line) =>
        new Paragraph({
          alignment: isHeader || fillColor ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text: line.length ? line : ' ',
              bold: isHeader,
              color: isHeader ? WHITE : '111827',
              size: options.fontSize,
            }),
          ],
        }),
    ),
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
      top: options.cellMargin,
      bottom: options.cellMargin,
      left: options.cellMargin,
      right: options.cellMargin,
    },
  });
}

export function createDocxMaterialityCell(label: string, width: number, options: DocxTableOptions) {
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
      top: options.cellMargin,
      bottom: options.cellMargin,
      left: options.cellMargin,
      right: options.cellMargin,
    },
  });
}

export function createDocxIndicatorCell(
  icon: Uint8Array | undefined,
  width: number,
  options: DocxTableOptions
) {
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
      top: options.cellMargin,
      bottom: options.cellMargin,
      left: options.cellMargin,
      right: options.cellMargin,
    },
  });
}

export async function exportRowsDocx(
  rows: ExportRow[],
  headers: string[],
  title: string,
  filename: string,
  indicatorIcons?: Map<string, Uint8Array>
) {
  const isWideTable = headers.length >= 10;
  const tableOptions: DocxTableOptions = {
    fontSize: getDocxFontSize(headers.length),
    cellMargin: isWideTable ? DOCX_COMPACT_CELL_MARGIN_TWIPS : DOCX_DEFAULT_CELL_MARGIN_TWIPS,
  };
  const columnWidths = getDocxColumnWidths(headers);
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((header, index) =>
        createDocxCell(header, true, columnWidths[index] ?? 8, tableOptions)
      ),
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          children: headers.map((header, index) => {
            const columnWidth = columnWidths[index] ?? 8;
            if (isMaterialityHeader(header)) {
              return createDocxMaterialityCell(toCellText(row[header]), columnWidth, tableOptions);
            }
            if (isIndicatorHeader(header)) {
              return createDocxIndicatorCell(
                indicatorIcons?.get(toCellText(row[header])),
                columnWidth,
                tableOptions
              );
            }
            return createDocxCell(
              toCellText(row[header]),
              false,
              columnWidth,
              tableOptions,
              getHighlightFill(header, row[header])
            );
          }),
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: DOCX_LANDSCAPE_PAGE_WIDTH_TWIPS,
              height: DOCX_LANDSCAPE_PAGE_HEIGHT_TWIPS,
            },
            margin: {
              top: DOCX_LANDSCAPE_MARGIN_TWIPS,
              right: DOCX_LANDSCAPE_MARGIN_TWIPS,
              bottom: DOCX_LANDSCAPE_MARGIN_TWIPS,
              left: DOCX_LANDSCAPE_MARGIN_TWIPS,
            },
          },
        },
        children: [
          new Paragraph({
            text: title,
            heading: 'Heading1',
            spacing: { after: 400 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
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

export const DOCX_DEFAULT_COLUMN_WEIGHTS: Record<string, number> = {
  ID: 6,
  Ключ: 8,
  'Название проверки': 34,
  'Тип проверки': 10,
  Вид: 12,
  'Краткое название': 16,
  'Квартал проверки': 8,
  'Дата начала': 9,
  'Дата окончания': 9,
  'Руководитель проверки': 14,
  Статус: 8,
  'Номер приказа': 8,
  'Дата приказа': 9,
  'Номер программы': 8,
  'Дата программы': 9,
  'Номер АЗ': 7,
  'Дата АЗ': 8,
  'Номер ДЗ': 7,
  'Дата ДЗ': 8,
  Процесс: 8,
  СВК: 6,
  СУР: 6,
  СВИК: 6,
};

export const DOCX_RECOMMENDATION_COLUMN_WEIGHTS: Record<string, number> = {
  ID: 4,
  Ключ: 7,
  'Название проверки': 21,
  'Название рекомендации': 26,
  'Название наблюдения': 18,
  'Информация о выполнении': 20,
  'Объект аудита': 12,
  Индикатор: 5,
  Вид: 8,
  'Срок контроля': 7,
  'Уровень существенности': 6,
  Аудитор: 8,
  'Руководитель объекта аудита': 10,
  Статус: 7,
  'Дополнительный статус': 8,
};

export function getDocxColumnWidths(headers: string[]): number[] {
  const isRecommendationTable = headers.includes('Название рекомендации');
  const weightsByHeader = isRecommendationTable
    ? DOCX_RECOMMENDATION_COLUMN_WEIGHTS
    : DOCX_DEFAULT_COLUMN_WEIGHTS;
  const weights = headers.map((header) => weightsByHeader[header] ?? 8);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => Math.floor((weight / total) * 100));
  let remainder = 100 - widths.reduce((sum, width) => sum + width, 0);
  let index = 0;
  while (remainder > 0) {
    widths[index % widths.length] += 1;
    remainder -= 1;
    index += 1;
  }
  return widths;
}

export async function exportChecksDocx(checks: Check[], filename: string, yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  await exportRowsDocx(rows, getHeaders(rows, CHECK_COLUMN_KEYS), 'Проверки — Сокол', filename);
}

export async function exportRecommendationsTableDocx(
  recommendations: Recommendation[],
  checks: Check[],
  filename: string,
  yearlyNumbers: Map<string, number>,
) {
  const rows = toRecommendationTableRows(recommendations, checks, yearlyNumbers);
  const indicatorIcons = await preloadIndicatorIcons(rows.map((row) => toCellText(row.Индикатор)));
  await exportRowsDocx(
    rows,
    getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS),
    'Рекомендации — Сокол',
    filename,
    indicatorIcons
  );
}
