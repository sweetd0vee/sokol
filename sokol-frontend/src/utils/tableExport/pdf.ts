import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Check } from '../../types/check';
import type { Recommendation } from '../../types/recommendation';
import { indicatorIconBytesToDataUrl, preloadIndicatorIcons } from '../exportIndicatorIcons';
import {
  BORDER_GRAY,
  CHECK_COLUMN_KEYS,
  getHeaders,
  getHighlightFill,
  getMaterialityDotColor,
  HEADER_BLUE,
  isIndicatorHeader,
  isMaterialityHeader,
  LIGHT_ROW_FILL,
  PDF_INDICATOR_ICON_SIZE,
  PDF_MATERIALITY_DOT_RADIUS,
  RECOMMENDATION_TABLE_COLUMN_KEYS,
  toCellText,
  toCheckRows,
  toRecommendationTableRows,
  WHITE,
} from './shared';
import type { ExportRow } from './types';

pdfMake.addVirtualFileSystem(pdfFonts);

export function getPdfColumnWidths(headers: string[]): Array<number | '*'> {
  const widthByHeader: Record<string, number | '*'> = {
    ID: 28,
    Ключ: 42,
    'Название рекомендации': '*',
    'Название наблюдения': '*',
    'Информация о выполнении': '*',
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
    'Квартал проверки': 44,
    'Дата начала': 44,
    'Руководитель проверки': 62,
  };
  return headers.map((header) => widthByHeader[header] ?? '*');
}

export function getPdfFontSize(columnCount: number) {
  if (columnCount >= 10) {
    return 6.5;
  }
  if (columnCount >= 8) {
    return 7.5;
  }
  return 9;
}

export function exportRowsPdf(
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
          const radius = PDF_MATERIALITY_DOT_RADIUS;
          const diameter = PDF_INDICATOR_ICON_SIZE;
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
              columns: [
                { width: '*', text: '' },
                {
                  width: PDF_INDICATOR_ICON_SIZE,
                  image: imageKey,
                  fit: [PDF_INDICATOR_ICON_SIZE, PDF_INDICATOR_ICON_SIZE],
                },
                { width: '*', text: '' },
              ],
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
          ...(header === 'ID' ? { noWrap: true } : {}),
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

export function exportChecksPdf(checks: Check[], filename: string, yearlyNumbers: Map<string, number>) {
  const rows = toCheckRows(checks, yearlyNumbers);
  exportRowsPdf(rows, getHeaders(rows, CHECK_COLUMN_KEYS), 'Проверки — Сокол', filename);
}

export async function exportRecommendationsTablePdf(
  recommendations: Recommendation[],
  checks: Check[],
  filename: string,
  yearlyNumbers: Map<string, number>,
) {
  const rows = toRecommendationTableRows(recommendations, checks, yearlyNumbers);
  const indicatorIcons = await preloadIndicatorIcons(rows.map((row) => toCellText(row.Индикатор)));
  exportRowsPdf(
    rows,
    getHeaders(rows, RECOMMENDATION_TABLE_COLUMN_KEYS),
    'Рекомендации — Сокол',
    filename,
    indicatorIcons
  );
}
