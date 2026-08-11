import * as XLSX from 'xlsx-js-style';
import pdfMake from 'pdfmake/build/pdfmake';
import type { Content, TableCell as PdfTableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Check } from '../types/check';
import type { MaterialityLevel, Recommendation } from '../types/recommendation';
import { getCheckStatusLabel, getCheckTypeLabel, getCheckViewLabel } from '../constants/checks';
import {
  getIndicatorLabel,
  getMaterialityLevelLabel,
  getRecommendationAdditionalStatusLabel,
  getRecommendationStatusLabel,
} from '../constants/recommendations';
import {
  buildAuditorDistribution,
  buildAuditorPeriodMatrix,
  buildCompletionShare,
  buildCumulativeSeries,
  buildDocumentReadiness,
  buildDurationDistribution,
  buildEffectivenessMatrix,
  buildPeriodSeries,
  buildStatusDistribution,
  buildTypeDistribution,
  buildTypeStatusBreakdown,
  buildViewDistribution,
  summarizeChecks,
  type PeriodGranularity,
} from './checkAnalytics';
import {
  buildAdditionalStatusDistribution,
  buildAuditorMaterialityRows,
  buildAuditorPeriodMatrix as buildRecAuditorPeriodMatrix,
  buildAuditObjectDistribution,
  buildCheckLinkDistribution,
  buildCumulativeSeries as buildRecCumulativeSeries,
  buildIndicatorDistribution,
  buildManagerDistribution,
  buildMaterialityDistribution,
  buildMaterialityPeriodMatrix,
  buildPeriodSeries as buildRecPeriodSeries,
  buildStatusDistribution as buildRecStatusDistribution,
  summarizeRecommendations,
} from './recommendationAnalytics';
import { formatRuDate } from './dates';
import {
  exportVisualAnalyticsReport,
  type VisualAnalyticsKind,
  type VisualExportMetaRow,
} from './analyticsVisualExport';

pdfMake.addVirtualFileSystem(pdfFonts);

export const ANALYTICS_EXPORT_FORMATS = [
  { value: 'xlsx', label: 'XLSX' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'html', label: 'HTML' },
] as const;

export type AnalyticsExportFormat = (typeof ANALYTICS_EXPORT_FORMATS)[number]['value'];

export type ChecksDashboardExportInput = {
  checks: Check[];
  filteredChecks: Check[];
  granularity: PeriodGranularity;
  auditors: string[];
  departments?: string[];
  selectedPeriodLabels?: string[];
  selectedSections: string[];
  /** When set (server analytics), used instead of checks.length / filteredChecks.length. */
  universeTotal?: number;
  filteredTotal?: number;
  effectivenessMatrixOverride?: ReturnType<typeof buildEffectivenessMatrix>;
};

export type RecommendationsDashboardExportInput = {
  recommendations: Recommendation[];
  filteredRecommendations: Recommendation[];
  granularity: PeriodGranularity;
  dateFrom: Date | null;
  dateTo: Date | null;
  auditors: string[];
  departments?: string[];
  materialityLevels: MaterialityLevel[];
  selectedSections: string[];
};

export type GenericAnalyticsDashboardExportInput = {
  kind: VisualAnalyticsKind;
  documentTitle: string;
  filenamePrefix: string;
  selectedSections: string[];
  meta: VisualExportMetaRow[];
};

type SheetRow = Record<string, string | number>;

const HEADER_BLUE = '003366';
const LIGHT_ROW = 'F8FAFC';
const BORDER = 'D1D5DB';
const WHITE = 'FFFFFF';
const VIOLET = 'EDE9FE';
const SKY = 'E0F2FE';

const FONT = { name: 'Times New Roman', sz: 11 };

function formatFilterDate(date: Date | null) {
  return date ? date.toLocaleDateString('ru-RU') : '—';
}

function granularityLabel(value: PeriodGranularity) {
  if (value === 'month') {return 'По месяцам';}
  if (value === 'quarter') {return 'По кварталам';}
  return 'По годам';
}

function styleHeaderCell(cell: XLSX.CellObject, fill = HEADER_BLUE) {
  cell.s = {
    font: { ...FONT, bold: true, color: { rgb: WHITE } },
    fill: { fgColor: { rgb: fill } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: BORDER } },
      bottom: { style: 'thin', color: { rgb: BORDER } },
      left: { style: 'thin', color: { rgb: BORDER } },
      right: { style: 'thin', color: { rgb: BORDER } },
    },
  };
}

function styleBodyCell(cell: XLSX.CellObject, options?: { fill?: string; center?: boolean; bold?: boolean }) {
  cell.s = {
    font: { ...FONT, bold: Boolean(options?.bold), color: { rgb: '111827' } },
    fill: options?.fill ? { fgColor: { rgb: options.fill } } : undefined,
    alignment: {
      horizontal: options?.center ? 'center' : 'left',
      vertical: 'center',
      wrapText: true,
    },
    border: {
      top: { style: 'thin', color: { rgb: BORDER } },
      bottom: { style: 'thin', color: { rgb: BORDER } },
      left: { style: 'thin', color: { rgb: BORDER } },
      right: { style: 'thin', color: { rgb: BORDER } },
    },
  };
}

function autoCols(ws: XLSX.WorkSheet, headers: string[], rows: SheetRow[]) {
  ws['!cols'] = headers.map((header) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? '').length),
      8,
    );
    return { wch: Math.min(Math.max(maxLength + 2, 12), 36) };
  });
}

function createSheetFromRows(rows: SheetRow[], headerFill = HEADER_BLUE) {
  const headers = rows.length > 0 ? Object.keys(rows[0]!) : ['Показатель', 'Значение'];
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Показатель: 'Нет данных', Значение: '' }]);
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[address] as XLSX.CellObject | undefined;
      if (!cell) {continue;}
      if (row === range.s.r) {
        styleHeaderCell(cell, headerFill);
      } else {
        styleBodyCell(cell, {
          fill: row % 2 === 0 ? LIGHT_ROW : undefined,
          center: col > range.s.c,
        });
      }
    }
  }
  autoCols(ws, headers, rows);
  ws['!rows'] = [{ hpt: 22 }];
  return ws;
}

function createTitleSheet(meta: Array<[string, string]>, kpis: Array<[string, string | number]>) {
  const aoa: Array<Array<string | number>> = [
    ['Аналитический отчёт SOKOL', ''],
    ['', ''],
    ['Параметры выборки', ''],
    ...meta.map(([key, value]) => [key, value]),
    ['', ''],
    ['Ключевые показатели', ''],
    ['Показатель', 'Значение'],
    ...kpis.map(([key, value]) => [key, value]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 1-based Excel rows:
  // 1 title, 2 blank, 3 section, 4..(3+meta.length) meta, then blank, section, header, kpis
  const metaFirstRow = 4;
  const kpiSectionRow = metaFirstRow + meta.length + 1;
  const kpiHeaderRow = kpiSectionRow + 1;

  const safeStyle = (address: string, styler: (cell: XLSX.CellObject) => void) => {
    const cell = ws[address] as XLSX.CellObject | undefined;
    if (cell) {
      styler(cell);
    }
  };

  safeStyle('A1', (cell) => {
    cell.s = {
      font: { name: 'Times New Roman', sz: 16, bold: true, color: { rgb: HEADER_BLUE } },
      alignment: { vertical: 'center' },
    };
  });
  safeStyle('A3', (cell) => styleHeaderCell(cell, '312E81'));
  for (let i = 0; i < meta.length; i += 1) {
    const row = metaFirstRow + i;
    safeStyle(`A${row}`, (cell) => styleBodyCell(cell, { bold: true, fill: VIOLET }));
    safeStyle(`B${row}`, (cell) => styleBodyCell(cell, { fill: LIGHT_ROW }));
  }
  safeStyle(`A${kpiSectionRow}`, (cell) => styleHeaderCell(cell, '065F46'));
  safeStyle(`A${kpiHeaderRow}`, (cell) => styleHeaderCell(cell));
  safeStyle(`B${kpiHeaderRow}`, (cell) => styleHeaderCell(cell));
  for (let i = 0; i < kpis.length; i += 1) {
    const row = kpiHeaderRow + 1 + i;
    safeStyle(`A${row}`, (cell) =>
      styleBodyCell(cell, { bold: true, fill: i % 2 === 0 ? SKY : LIGHT_ROW }),
    );
    safeStyle(`B${row}`, (cell) =>
      styleBodyCell(cell, {
        center: true,
        fill: i % 2 === 0 ? SKY : LIGHT_ROW,
        bold: true,
      }),
    );
  }
  ws['!cols'] = [{ wch: 34 }, { wch: 42 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  return ws;
}

function appendNamedSheet(wb: XLSX.WorkBook, name: string, rows: SheetRow[], headerFill?: string) {
  const safeName = name.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, createSheetFromRows(rows, headerFill), safeName);
}

function matrixToRows(
  periods: Array<{ key: string; label: string }>,
  rows: Array<{ label: string; total: number; byPeriod: Record<string, number> }>,
  firstColName: string,
): SheetRow[] {
  return rows.map((row) => {
    const result: SheetRow = { [firstColName]: row.label };
    periods.forEach((period) => {
      result[period.label] = row.byPeriod[period.key] ?? 0;
    });
    result.Итого = row.total;
    return result;
  });
}

function exportChecksDashboardXlsx(input: ChecksDashboardExportInput) {
  const { filteredChecks, granularity, auditors, checks, selectedSections } = input;
  const selected = new Set(selectedSections);
  if (selected.size === 0) {
    throw new Error('Выберите хотя бы один дашборд для экспорта');
  }

  const summary = summarizeChecks(filteredChecks);
  const periodSeries = buildPeriodSeries(filteredChecks, granularity);
  const cumulative = buildCumulativeSeries(filteredChecks, granularity);
  const statuses = buildStatusDistribution(filteredChecks);
  const types = buildTypeDistribution(filteredChecks);
  const views = buildViewDistribution(filteredChecks);
  const auditorsDist = buildAuditorDistribution(filteredChecks);
  const matrix = buildAuditorPeriodMatrix(filteredChecks, granularity);
  const durations = buildDurationDistribution(filteredChecks);
  const docs = buildDocumentReadiness(filteredChecks);
  const typeStatus = buildTypeStatusBreakdown(filteredChecks);

  const wb = XLSX.utils.book_new();
  const meta: Array<[string, string]> = [
    ['Раздел', 'Проверки'],
    ['Дата формирования', new Date().toLocaleString('ru-RU')],
    ['Группировка', granularityLabel(granularity)],
    ['Аудиторы', auditors.length ? auditors.join(', ') : 'Все'],
    ['Записей в выборке', String(filteredChecks.length)],
    ['Всего в системе', String(checks.length)],
    ['Листы в отчёте', String(selected.size)],
  ];

  if (selected.has('summary')) {
    XLSX.utils.book_append_sheet(
      wb,
      createTitleSheet(meta, [
        ['Всего проверок', summary.total],
        ['Запланировано', summary.not_started],
        ['В процессе', summary.in_progress],
        ['Завершено', summary.completed],
        ['Доля завершённых, %', buildCompletionShare(filteredChecks)],
      ]),
      'Сводка',
    );
  }

  if (selected.has('periods')) {
    appendNamedSheet(
      wb,
      'По периодам',
      periodSeries.map((item) => ({
        Период: item.label,
        Всего: item.total,
        Запланировано: item.not_started,
        'В процессе': item.in_progress,
        Завершено: item.completed,
      })),
      '1D4ED8',
    );
  }
  if (selected.has('cumulative')) {
    appendNamedSheet(
      wb,
      'Накопительно',
      cumulative.map((item) => ({
        Период: item.label,
        'За период': item.total,
        Накопительно: item.cumulative,
      })),
      '312E81',
    );
  }
  if (selected.has('statuses')) {
    appendNamedSheet(
      wb,
      'Статусы',
      statuses.map((item) => ({ Показатель: item.name, Значение: item.value })),
      '065F46',
    );
  }
  if (selected.has('types')) {
    appendNamedSheet(
      wb,
      'Типы проверок',
      types.map((item) => ({ Показатель: item.name, Значение: item.value })),
      '0E7490',
    );
  }
  if (selected.has('views')) {
    appendNamedSheet(
      wb,
      'Виды проверок',
      views.map((item) => ({ Показатель: item.name, Значение: item.value })),
      '7C3AED',
    );
  }
  if (selected.has('typeStatus')) {
    appendNamedSheet(
      wb,
      'Тип и статус',
      typeStatus.map((item) => ({
        Тип: item.name,
        Запланировано: item.not_started,
        'В процессе': item.in_progress,
        Завершено: item.completed,
      })),
      'B45309',
    );
  }
  if (selected.has('auditors')) {
    appendNamedSheet(
      wb,
      'Аудиторы',
      auditorsDist.map((item) => ({ Аудитор: item.name, Проверок: item.value })),
      '1E40AF',
    );
  }
  if (selected.has('auditorMatrix')) {
    appendNamedSheet(
      wb,
      'Матрица аудитор-период',
      matrixToRows(
        matrix.periods,
        matrix.rows.map((row) => ({ label: row.auditor, total: row.total, byPeriod: row.byPeriod })),
        'Руководитель',
      ),
      '4338CA',
    );
  }
  if (selected.has('durations')) {
    appendNamedSheet(
      wb,
      'Длительность',
      durations.map((item) => ({ Диапазон: item.name, Проверок: item.value })),
      '0369A1',
    );
  }
  if (selected.has('documents')) {
    appendNamedSheet(
      wb,
      'Документы',
      docs.map((item) => ({
        Документ: item.name,
        Заполнено: item.filled,
        Пусто: item.empty,
      })),
      'BE123C',
    );
  }
  if (selected.has('source')) {
    appendNamedSheet(
      wb,
      'Исходные данные',
      filteredChecks.map((check) => ({
        ID: check.id,
        Ключ: check.serial_number,
        Название: check.check_name,
        Тип: getCheckTypeLabel(check.check_type),
        Вид: getCheckViewLabel(check.check_view),
        'Дата начала': formatRuDate(check.start_date),
        'Дата окончания': formatRuDate(check.end_date),
        Руководитель: check.check_leader,
        Статус: getCheckStatusLabel(check.status),
      })),
      HEADER_BLUE,
    );
  }

  if (!wb.SheetNames.length) {
    throw new Error('Выберите хотя бы один дашборд для экспорта');
  }

  XLSX.writeFile(wb, `analytics-checks-${stamp()}.xlsx`);
}

function exportRecommendationsDashboardXlsx(input: RecommendationsDashboardExportInput) {
  const {
    filteredRecommendations,
    recommendations,
    granularity,
    dateFrom,
    dateTo,
    auditors,
    materialityLevels,
    selectedSections,
  } = input;
  const selected = new Set(selectedSections);
  if (selected.size === 0) {
    throw new Error('Выберите хотя бы один дашборд для экспорта');
  }

  const summary = summarizeRecommendations(filteredRecommendations);
  const periodSeries = buildRecPeriodSeries(filteredRecommendations, granularity);
  const cumulative = buildRecCumulativeSeries(filteredRecommendations, granularity);
  const materiality = buildMaterialityDistribution(filteredRecommendations);
  const indicators = buildIndicatorDistribution(filteredRecommendations);
  const managers = buildManagerDistribution(filteredRecommendations);
  const objects = buildAuditObjectDistribution(filteredRecommendations);
  const auditorMat = buildAuditorMaterialityRows(filteredRecommendations);
  const auditorMatrix = buildRecAuditorPeriodMatrix(filteredRecommendations, granularity);
  const materialityMatrix = buildMaterialityPeriodMatrix(filteredRecommendations, granularity);
  const checks = buildCheckLinkDistribution(filteredRecommendations);

  const wb = XLSX.utils.book_new();
  const meta: Array<[string, string]> = [
    ['Раздел', 'Аналитика рекомендаций'],
    ['Дата формирования', new Date().toLocaleString('ru-RU')],
    ['Группировка', granularityLabel(granularity)],
    ['Срок с', formatFilterDate(dateFrom)],
    ['Срок по', formatFilterDate(dateTo)],
    ['Аудиторы', auditors.length ? auditors.join(', ') : 'Все'],
    [
      'Существенность',
      materialityLevels.length
        ? materialityLevels.map((level) => getMaterialityLevelLabel(level)).join(', ')
        : 'Все уровни',
    ],
    ['Записей в выборке', String(filteredRecommendations.length)],
    ['Всего в системе', String(recommendations.length)],
    ['Листы в отчёте', String(selected.size)],
  ];

  if (selected.has('summary')) {
    XLSX.utils.book_append_sheet(
      wb,
      createTitleSheet(meta, [
        ['Всего рекомендаций', summary.total],
        ['Исполнено', summary.byStatus.completed],
        ['Не решено', summary.byStatus.unresolved],
        ['На контроле', summary.byStatus.on_control],
        ['В процессе', summary.byStatus.in_progress],
        ['Высокая существенность', summary.byMateriality.высокий],
        ['Средняя существенность', summary.byMateriality.средний],
        ['Низкая существенность', summary.byMateriality.низкий],
        ['Доля исполнения, %', summary.completionRate],
        ['Доля нарушения срока, %', summary.violationRate],
        ['С продлениями', summary.withExtensions],
        ['С датой закрытия', summary.withCompletionDate],
      ]),
      'Сводка',
    );
  }
  if (selected.has('periods')) {
    appendNamedSheet(
      wb,
      'По периодам',
      periodSeries.map((item) => ({
        Период: item.label,
        Всего: item.total,
        Исполнено: item.completed,
        'В процессе': item.in_progress,
        'На контроле': item.on_control,
        'Не решено': item.unresolved,
        Низкий: item.low,
        Средний: item.medium,
        Высокий: item.high,
      })),
      '7C3AED',
    );
  }
  if (selected.has('cumulative')) {
    appendNamedSheet(
      wb,
      'Количество рекомендаций',
      cumulative.map((item) => ({
        Период: item.label,
        'За период': item.total,
        Всего: item.cumulative,
      })),
      '4F46E5',
    );
  }
  if (selected.has('materialityByPeriod')) {
    appendNamedSheet(
      wb,
      'Сущ по периодам',
      periodSeries.map((item) => ({
        Период: item.label,
        Низкий: item.low,
        Средний: item.medium,
        Высокий: item.high,
      })),
      'BE123C',
    );
  }
  if (selected.has('statusByPeriod')) {
    appendNamedSheet(
      wb,
      'Статусы по периодам',
      periodSeries.map((item) => ({
        Период: item.label,
        Исполнено: item.completed,
        'В процессе': item.in_progress,
        'На контроле': item.on_control,
        'Не решено': item.unresolved,
      })),
      'CA8A04',
    );
  }
  if (selected.has('materiality')) {
    appendNamedSheet(
      wb,
      'Существенность',
      materiality.map((item) => ({ Уровень: item.name, Количество: item.value })),
      '16A34A',
    );
  }
  if (selected.has('indicators')) {
    appendNamedSheet(
      wb,
      'Индикаторы',
      indicators.map((item) => ({ Индикатор: item.name, Количество: item.value })),
      '0891B2',
    );
  }
  if (selected.has('auditorMateriality')) {
    appendNamedSheet(
      wb,
      'Аудитор-существенность',
      auditorMat.map((row) => ({
        Аудитор: row.auditor,
        Всего: row.total,
        Низкий: row.низкий,
        Средний: row.средний,
        Высокий: row.высокий,
        Исполнено: row.completed,
        'Нарушение срока': row.violated,
      })),
      'BE123C',
    );
  }
  if (selected.has('auditorPerformance')) {
    appendNamedSheet(
      wb,
      'Исполнение аудиторов',
      auditorMat.map((row) => ({
        Аудитор: row.auditor,
        Всего: row.total,
        Исполнено: row.completed,
        'Доля исполнения, %': row.total ? Math.round((row.completed / row.total) * 100) : 0,
        'Нарушение срока': row.violated,
      })),
      '059669',
    );
  }
  if (selected.has('managers')) {
    appendNamedSheet(
      wb,
      'Менеджеры',
      managers.map((item) => ({ Менеджер: item.name, Количество: item.value })),
      '7C3AED',
    );
  }
  if (selected.has('objects')) {
    appendNamedSheet(
      wb,
      'Карта департаментов',
      objects.map((item) => ({ Департамент: item.name, Количество: item.value })),
      '0E7490',
    );
  }
  if (selected.has('checkLinks')) {
    appendNamedSheet(
      wb,
      'По проверкам',
      checks.map((item) => ({ Проверка: item.name, Рекомендаций: item.value })),
      '0369A1',
    );
  }
  if (selected.has('auditorMatrix')) {
    appendNamedSheet(
      wb,
      'Матрица аудитор-период',
      matrixToRows(
        auditorMatrix.periods,
        auditorMatrix.rows.map((row) => ({
          label: row.auditor,
          total: row.total,
          byPeriod: row.byPeriod,
        })),
        'Аудитор',
      ),
      '4338CA',
    );
  }
  if (selected.has('materialityMatrix')) {
    appendNamedSheet(
      wb,
      'Матрица сущ-период',
      matrixToRows(
        materialityMatrix.periods,
        materialityMatrix.rows.map((row) => ({
          label: row.label,
          total: row.total,
          byPeriod: row.byPeriod,
        })),
        'Существенность',
      ),
      'E11D48',
    );
  }
  if (selected.has('source')) {
    appendNamedSheet(
      wb,
      'Исходные данные',
      filteredRecommendations.map((item) => ({
        ID: item.id,
        Ключ: item.serial_number,
        '№': item.sequence_number,
        Название: item.name,
        'Объект аудита': item.audit_object,
        Индикатор: getIndicatorLabel(item.indicator),
        Существенность: getMaterialityLevelLabel(item.materiality_level),
        Срок: formatRuDate(item.deadline),
        Аудитор: item.auditor,
        Менеджер: item.manager,
        Статус: getRecommendationStatusLabel(item.status),
        'Доп. статус': getRecommendationAdditionalStatusLabel(item.additional_status),
        'Дата исполнения': formatRuDate(item.actual_completion_date),
      })),
      HEADER_BLUE,
    );
  }

  if (!wb.SheetNames.length) {
    throw new Error('Выберите хотя бы один дашборд для экспорта');
  }

  XLSX.writeFile(wb, `analytics-recommendations-${stamp()}.xlsx`);
}

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function pdfSectionTitle(text: string): Content {
  return {
    text,
    style: 'sectionTitle',
    margin: [0, 14, 0, 8],
  };
}

function pdfKpiTable(items: Array<[string, string | number]>): Content {
  const body: PdfTableCell[][] = [
    [
      { text: 'Показатель', style: 'tableHeader', fillColor: `#${HEADER_BLUE}` },
      { text: 'Значение', style: 'tableHeader', fillColor: `#${HEADER_BLUE}` },
    ],
    ...items.map(([label, value], index): PdfTableCell[] => [
      {
        text: label,
        style: 'tableCell',
        ...(index % 2 === 0 ? { fillColor: `#${LIGHT_ROW}` } : {}),
      },
      {
        text: String(value),
        style: 'tableCell',
        alignment: 'center',
        bold: true,
        fillColor: index % 2 === 0 ? `#${SKY}` : `#${LIGHT_ROW}`,
      },
    ]),
  ];

  return {
    table: {
      widths: ['*', 80],
      body,
    },
    layout: {
      hLineColor: () => `#${BORDER}`,
      vLineColor: () => `#${BORDER}`,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };
}

function pdfSimpleTable(
  headers: string[],
  rows: Array<Array<string | number>>,
  headerFill = HEADER_BLUE,
): Content {
  if (rows.length === 0) {
    return { text: 'Нет данных для выбранных фильтров.', style: 'muted', margin: [0, 0, 0, 8] };
  }
  const body: PdfTableCell[][] = [
    headers.map((header) => ({
      text: header,
      style: 'tableHeader',
      fillColor: `#${headerFill}`,
    })),
    ...rows.map((row, rowIndex): PdfTableCell[] =>
      row.map((cell, cellIndex) => ({
        text: String(cell ?? ''),
        style: 'tableCell',
        alignment: cellIndex === 0 ? 'left' : 'center',
        ...(rowIndex % 2 === 0 ? { fillColor: `#${LIGHT_ROW}` } : {}),
      })),
    ),
  ];
  return {
    table: {
      headerRows: 1,
      widths: headers.map((_, index) => (index === 0 ? '*' : 'auto')),
      body,
      dontBreakRows: true,
    },
    layout: {
      hLineColor: () => `#${BORDER}`,
      vLineColor: () => `#${BORDER}`,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, 4],
  };
}

function buildPdfDoc(
  title: string,
  meta: Array<[string, string]>,
  sections: Content[],
): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [24, 28, 24, 28],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      color: '#111827',
    },
    styles: {
      title: {
        fontSize: 18,
        bold: true,
        color: `#${HEADER_BLUE}`,
      },
      subtitle: {
        fontSize: 10,
        color: '#64748B',
      },
      sectionTitle: {
        fontSize: 12,
        bold: true,
        color: `#${HEADER_BLUE}`,
      },
      tableHeader: {
        bold: true,
        color: `#${WHITE}`,
        alignment: 'center',
        fontSize: 8,
      },
      tableCell: {
        fontSize: 8,
        color: '#111827',
      },
      muted: {
        fontSize: 9,
        color: '#64748B',
        italics: true,
      },
      metaLabel: {
        bold: true,
        fontSize: 9,
      },
    },
    footer: (currentPage, pageCount) => ({
      text: `SOKOL · ${title} · стр. ${currentPage} из ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: '#64748B',
      margin: [0, 8, 0, 0],
    }),
    content: [
      { text: title, style: 'title', margin: [0, 0, 0, 4] },
      {
        text: `Сформировано: ${new Date().toLocaleString('ru-RU')}`,
        style: 'subtitle',
        margin: [0, 0, 0, 12],
      },
      pdfSectionTitle('Параметры выборки'),
      {
        table: {
          widths: [160, '*'],
          body: meta.map(([label, value], index) => [
            {
              text: label,
              style: 'metaLabel',
              fillColor: index % 2 === 0 ? `#${VIOLET}` : `#${LIGHT_ROW}`,
            },
            {
              text: value,
              style: 'tableCell',
              fillColor: index % 2 === 0 ? `#${VIOLET}` : `#${LIGHT_ROW}`,
            },
          ]),
        },
        layout: {
          hLineColor: () => `#${BORDER}`,
          vLineColor: () => `#${BORDER}`,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 8],
      },
      ...sections,
    ],
  };
}

function exportChecksDashboardPdf(input: ChecksDashboardExportInput) {
  const { filteredChecks, checks, granularity, auditors, selectedSections } = input;
  const selected = new Set(selectedSections);
  if (selected.size === 0) {
    throw new Error('Выберите хотя бы один дашборд для экспорта');
  }

  const summary = summarizeChecks(filteredChecks);
  const periodSeries = buildPeriodSeries(filteredChecks, granularity);
  const statuses = buildStatusDistribution(filteredChecks);
  const types = buildTypeDistribution(filteredChecks);
  const views = buildViewDistribution(filteredChecks);
  const auditorsDist = buildAuditorDistribution(filteredChecks);
  const matrix = buildAuditorPeriodMatrix(filteredChecks, granularity);
  const durations = buildDurationDistribution(filteredChecks);
  const docs = buildDocumentReadiness(filteredChecks);
  const typeStatus = buildTypeStatusBreakdown(filteredChecks);
  const sections: Content[] = [];

  if (selected.has('summary')) {
    sections.push(
      pdfSectionTitle('Ключевые показатели'),
      pdfKpiTable([
        ['Всего проверок', summary.total],
        ['Запланировано', summary.not_started],
        ['В процессе', summary.in_progress],
        ['Завершено', summary.completed],
        ['Доля завершённых, %', buildCompletionShare(filteredChecks)],
      ]),
    );
  }
  if (selected.has('periods') || selected.has('dynamics')) {
    sections.push(
      pdfSectionTitle('Динамика по периодам'),
      pdfSimpleTable(
        ['Период', 'Всего', 'Запланировано', 'В процессе', 'Завершено'],
        periodSeries.map((item) => [
          item.label,
          item.total,
          item.not_started,
          item.in_progress,
          item.completed,
        ]),
        '1D4ED8',
      ),
    );
  }
  if (selected.has('statuses')) {
    sections.push(
      pdfSectionTitle('Статусы'),
      pdfSimpleTable(
        ['Статус', 'Количество'],
        statuses.map((item) => [item.name, item.value]),
        '065F46',
      ),
    );
  }
  if (selected.has('types')) {
    sections.push(
      pdfSectionTitle('Типы проверок'),
      pdfSimpleTable(
        ['Тип', 'Количество'],
        types.map((item) => [item.name, item.value]),
        '0E7490',
      ),
    );
  }
  if (selected.has('views')) {
    sections.push(
      pdfSectionTitle('Виды проверок'),
      pdfSimpleTable(
        ['Вид', 'Количество'],
        views.map((item) => [item.name, item.value]),
        '7C3AED',
      ),
    );
  }
  if (selected.has('typeStatus')) {
    sections.push(
      pdfSectionTitle('Тип × статус'),
      pdfSimpleTable(
        ['Тип', 'Запланировано', 'В процессе', 'Завершено'],
        typeStatus.map((item) => [item.name, item.not_started, item.in_progress, item.completed]),
        'B45309',
      ),
    );
  }
  if (selected.has('auditors')) {
    sections.push(
      pdfSectionTitle('Нагрузка по аудиторам'),
      pdfSimpleTable(
        ['Руководитель', 'Проверок'],
        auditorsDist.map((item) => [item.name, item.value]),
        '1E40AF',
      ),
    );
  }
  if (selected.has('durations')) {
    sections.push(
      pdfSectionTitle('Длительность'),
      pdfSimpleTable(
        ['Диапазон', 'Проверок'],
        durations.map((item) => [item.name, item.value]),
        '0369A1',
      ),
    );
  }
  if (selected.has('documents')) {
    sections.push(
      pdfSectionTitle('Готовность документов'),
      pdfSimpleTable(
        ['Документ', 'Заполнено', 'Пусто'],
        docs.map((item) => [item.name, item.filled, item.empty]),
        'BE123C',
      ),
    );
  }
  if (selected.has('auditorMatrix')) {
    sections.push(
      pdfSectionTitle('Матрица аудитор × период'),
      pdfSimpleTable(
        ['Руководитель', ...matrix.periods.map((period) => period.label), 'Итого'],
        matrix.rows.map((row) => [
          row.auditor,
          ...matrix.periods.map((period) => row.byPeriod[period.key] ?? 0),
          row.total,
        ]),
        '4338CA',
      ),
    );
  }
  if (selected.has('source')) {
    sections.push(
      pdfSectionTitle('Исходные данные'),
      pdfSimpleTable(
        ['ID', 'Ключ', 'Название', 'Тип', 'Вид', 'Дата начала', 'Руководитель', 'Статус'],
        filteredChecks.map((check) => [
          check.id,
          check.serial_number,
          check.check_name,
          getCheckTypeLabel(check.check_type),
          getCheckViewLabel(check.check_view),
          formatRuDate(check.start_date),
          check.check_leader,
          getCheckStatusLabel(check.status),
        ]),
      ),
    );
  }

  if (sections.length === 0) {
    throw new Error('Выберите хотя бы один дашборд для экспорта');
  }

  const doc = buildPdfDoc(
    'Проверки — SOKOL',
    [
      ['Группировка', granularityLabel(granularity)],
      ...(input.selectedPeriodLabels?.map((label) => ['Период', label] as [string, string]) ?? []),
      ['Аудиторы', auditors.length ? auditors.join(', ') : 'Все'],
      ['Департаменты', input.departments?.length ? input.departments.join(', ') : 'Все'],
      ['Записей в выборке', String(filteredChecks.length)],
      ['Всего в системе', String(checks.length)],
      ['Разделов в отчёте', String(selected.size)],
    ],
    sections,
  );

  pdfMake.createPdf(doc).download(`analytics-checks-${stamp()}.pdf`);
}

function exportRecommendationsDashboardPdf(input: RecommendationsDashboardExportInput) {
  const {
    filteredRecommendations,
    recommendations,
    granularity,
    dateFrom,
    dateTo,
    auditors,
    departments = [],
    materialityLevels,
    selectedSections,
  } = input;
  const selected = new Set(selectedSections);
  if (selected.size === 0) {
    throw new Error('Выберите хотя бы один дашборд для экспорта');
  }

  const summary = summarizeRecommendations(filteredRecommendations);
  const periodSeries = buildRecPeriodSeries(filteredRecommendations, granularity);
  const materiality = buildMaterialityDistribution(filteredRecommendations);
  const indicators = buildIndicatorDistribution(filteredRecommendations);
  const auditorMat = buildAuditorMaterialityRows(filteredRecommendations);
  const objects = buildAuditObjectDistribution(filteredRecommendations);
  const managers = buildManagerDistribution(filteredRecommendations);
  const checks = buildCheckLinkDistribution(filteredRecommendations);
  const auditorMatrix = buildRecAuditorPeriodMatrix(filteredRecommendations, granularity);
  const materialityMatrix = buildMaterialityPeriodMatrix(filteredRecommendations, granularity);
  const sections: Content[] = [];

  if (selected.has('summary')) {
    sections.push(
      pdfSectionTitle('Ключевые показатели'),
      pdfKpiTable([
        ['Всего рекомендаций', summary.total],
        ['Исполнено', summary.byStatus.completed],
        ['Не решено', summary.byStatus.unresolved],
        ['На контроле', summary.byStatus.on_control],
        ['В процессе', summary.byStatus.in_progress],
        ['Высокая существенность', summary.byMateriality.высокий],
        ['Средняя существенность', summary.byMateriality.средний],
        ['Низкая существенность', summary.byMateriality.низкий],
        ['Доля исполнения, %', summary.completionRate],
        ['Доля нарушения срока, %', summary.violationRate],
        ['С продлениями', summary.withExtensions],
        ['С датой закрытия', summary.withCompletionDate],
      ]),
    );
  }
  if (selected.has('periods') || selected.has('materialityByPeriod') || selected.has('statusByPeriod') || selected.has('cumulative')) {
    sections.push(
      pdfSectionTitle('Динамика по периодам'),
      pdfSimpleTable(
        ['Период', 'Всего', 'Исполнено', 'В процессе', 'На контроле', 'Не решено', 'Низкий', 'Средний', 'Высокий'],
        periodSeries.map((item) => [
          item.label,
          item.total,
          item.completed,
          item.in_progress,
          item.on_control,
          item.unresolved,
          item.low,
          item.medium,
          item.high,
        ]),
        '7C3AED',
      ),
    );
  }
  if (selected.has('materiality')) {
    sections.push(
      pdfSectionTitle('Существенность'),
      pdfSimpleTable(
        ['Уровень', 'Количество'],
        materiality.map((item) => [item.name, item.value]),
        '16A34A',
      ),
    );
  }
  if (selected.has('indicators')) {
    sections.push(
      pdfSectionTitle('Индикаторы'),
      pdfSimpleTable(
        ['Индикатор', 'Количество'],
        indicators.map((item) => [item.name, item.value]),
        '0891B2',
      ),
    );
  }
  if (selected.has('auditorMateriality') || selected.has('auditorPerformance')) {
    sections.push(
      pdfSectionTitle('Аудитор × существенность'),
      pdfSimpleTable(
        ['Аудитор', 'Всего', 'Низкий', 'Средний', 'Высокий', 'Исполнено', 'Нарушение срока'],
        auditorMat.map((row) => [
          row.auditor,
          row.total,
          row.низкий,
          row.средний,
          row.высокий,
          row.completed,
          row.violated,
        ]),
        'BE123C',
      ),
    );
  }
  if (selected.has('managers')) {
    sections.push(
      pdfSectionTitle('Менеджеры'),
      pdfSimpleTable(
        ['Менеджер', 'Количество'],
        managers.map((item) => [item.name, item.value]),
        '7C3AED',
      ),
    );
  }
  if (selected.has('objects')) {
    sections.push(
      pdfSectionTitle('Карта департаментов'),
      pdfSimpleTable(
        ['Объект аудита', 'Количество'],
        objects.map((item) => [item.name, item.value]),
        '0E7490',
      ),
    );
  }
  if (selected.has('checkLinks')) {
    sections.push(
      pdfSectionTitle('По проверкам'),
      pdfSimpleTable(
        ['Проверка', 'Рекомендаций'],
        checks.map((item) => [item.name, item.value]),
        '0369A1',
      ),
    );
  }
  if (selected.has('auditorMatrix')) {
    sections.push(
      pdfSectionTitle('Матрица аудитор × период'),
      pdfSimpleTable(
        ['Аудитор', ...auditorMatrix.periods.map((period) => period.label), 'Итого'],
        auditorMatrix.rows.map((row) => [
          row.auditor,
          ...auditorMatrix.periods.map((period) => row.byPeriod[period.key] ?? 0),
          row.total,
        ]),
        '4338CA',
      ),
    );
  }
  if (selected.has('materialityMatrix')) {
    sections.push(
      pdfSectionTitle('Матрица существенность × период'),
      pdfSimpleTable(
        ['Существенность', ...materialityMatrix.periods.map((period) => period.label), 'Итого'],
        materialityMatrix.rows.map((row) => [
          row.label,
          ...materialityMatrix.periods.map((period) => row.byPeriod[period.key] ?? 0),
          row.total,
        ]),
        'E11D48',
      ),
    );
  }
  if (selected.has('source')) {
    sections.push(
      pdfSectionTitle('Исходные данные'),
      pdfSimpleTable(
        ['ID', 'Ключ', 'Название', 'Существенность', 'Срок', 'Аудитор', 'Статус', 'Доп. статус'],
        filteredRecommendations.map((item) => [
          item.id,
          item.serial_number,
          item.name,
          getMaterialityLevelLabel(item.materiality_level),
          formatRuDate(item.deadline),
          item.auditor,
          getRecommendationStatusLabel(item.status),
          getRecommendationAdditionalStatusLabel(item.additional_status),
        ]),
      ),
    );
  }

  if (sections.length === 0) {
    throw new Error('Выберите хотя бы один дашборд для экспорта');
  }

  const doc = buildPdfDoc(
    'Аналитика рекомендаций — SOKOL',
    [
      ['Группировка', granularityLabel(granularity)],
      ['Срок с', formatFilterDate(dateFrom)],
      ['Срок по', formatFilterDate(dateTo)],
      ['Аудиторы', auditors.length ? auditors.join(', ') : 'Все'],
      ['Департаменты', departments.length ? departments.join(', ') : 'Все'],
      [
        'Существенность',
        materialityLevels.length
          ? materialityLevels.map((level) => getMaterialityLevelLabel(level)).join(', ')
          : 'Все уровни',
      ],
      ['Записей в выборке', String(filteredRecommendations.length)],
      ['Всего в системе', String(recommendations.length)],
      ['Разделов в отчёте', String(selected.size)],
    ],
    sections,
  );

  pdfMake.createPdf(doc).download(`analytics-recommendations-${stamp()}.pdf`);
}

// Legacy tabular exporters are kept as a fallback reference while the UI uses visual reports.
void exportChecksDashboardXlsx;
void exportRecommendationsDashboardXlsx;
void exportChecksDashboardPdf;
void exportRecommendationsDashboardPdf;

export async function exportChecksDashboard(
  input: ChecksDashboardExportInput,
  format: AnalyticsExportFormat,
) {
  const { checks, filteredChecks, granularity, auditors, selectedSections } = input;
  const universeTotal = input.universeTotal ?? checks.length;
  const filteredTotal = input.filteredTotal ?? filteredChecks.length;
  const effectivenessMatrix = selectedSections.includes('effectivenessMatrix')
    ? (input.effectivenessMatrixOverride ?? buildEffectivenessMatrix(filteredChecks))
    : undefined;
  await exportVisualAnalyticsReport({
    format,
    kind: 'checks',
    documentTitle: 'Проверки',
    filenamePrefix: 'analytics-checks',
    selectedSections,
    effectivenessMatrix,
    meta: [
      ['Группировка', granularityLabel(granularity)],
      ...(input.selectedPeriodLabels?.map((label) => ['Период', label] as [string, string]) ?? []),
      ['Аудиторы', auditors.length ? auditors.join(', ') : 'Все'],
      ['Департаменты', input.departments?.length ? input.departments.join(', ') : 'Все'],
      ['Записей в выборке', String(filteredTotal)],
      ['Всего в системе', String(universeTotal)],
      ['Дашбордов в отчёте', String(selectedSections.filter((id) => id !== 'source').length)],
      ['Сформировано', new Date().toLocaleString('ru-RU')],
    ],
  });
}

export async function exportGenericAnalyticsDashboard(
  input: GenericAnalyticsDashboardExportInput,
  format: AnalyticsExportFormat,
) {
  await exportVisualAnalyticsReport({
    format,
    kind: input.kind,
    documentTitle: input.documentTitle,
    filenamePrefix: input.filenamePrefix,
    selectedSections: input.selectedSections,
    meta: [...input.meta, ['Сформировано', new Date().toLocaleString('ru-RU')]],
  });
}

export async function exportRecommendationsDashboard(
  input: RecommendationsDashboardExportInput,
  format: AnalyticsExportFormat,
) {
  const {
    recommendations,
    filteredRecommendations,
    granularity,
    dateFrom,
    dateTo,
    auditors,
    materialityLevels,
    selectedSections,
  } = input;
  await exportVisualAnalyticsReport({
    format,
    kind: 'recommendations',
    documentTitle: 'Аналитика рекомендаций',
    filenamePrefix: 'analytics-recommendations',
    selectedSections,
    meta: [
      ['Группировка', granularityLabel(granularity)],
      ['Срок с', formatFilterDate(dateFrom)],
      ['Срок по', formatFilterDate(dateTo)],
      ['Аудиторы', auditors.length ? auditors.join(', ') : 'Все'],
      [
        'Существенность',
        materialityLevels.length
          ? materialityLevels.map((level) => getMaterialityLevelLabel(level)).join(', ')
          : 'Все уровни',
      ],
      ['Записей в выборке', String(filteredRecommendations.length)],
      ['Всего в системе', String(recommendations.length)],
      ['Дашбордов в отчёте', String(selectedSections.filter((id) => id !== 'source').length)],
      ['Сформировано', new Date().toLocaleString('ru-RU')],
    ],
  });
}
