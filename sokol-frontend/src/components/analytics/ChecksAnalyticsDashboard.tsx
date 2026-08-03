import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, X } from 'lucide-react';
import type { Check } from '../../types/check';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import { LIST_ACTION_BUTTON_CLASS } from '../../constants/formLayout';
import { ChartCard, EmptyChart, ExportSectionToolbar, KpiCard, PALETTE } from './AnalyticsChartPrimitives';
import {
  ANALYTICS_EXPORT_FORMATS,
  exportChecksDashboard,
  type AnalyticsExportFormat,
} from '../../utils/analyticsExport';
import {
  CHECK_EXPORT_SECTIONS,
  type CheckExportSectionId,
} from '../../constants/analyticsExportSections';
import { useExportSections } from '../../hooks/useExportSections';
import {
  buildAuditorDistribution,
  buildAuditorPeriodMatrix,
  buildCompletionShare,
  buildCumulativeSeries,
  buildDocumentReadiness,
  buildDurationDistribution,
  buildPeriodSeries,
  buildStatusDistribution,
  buildTypeDistribution,
  buildTypeStatusBreakdown,
  buildViewDistribution,
  buildViewRadar,
  collectCheckLeaders,
  filterChecksForAnalytics,
  summarizeChecks,
  type PeriodGranularity,
} from '../../utils/checkAnalytics';

const GRANULARITY_OPTIONS: { value: PeriodGranularity; label: string }[] = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

const CHART_COLORS = ['#003366', '#2563EB', '#6699FF', '#22C55E', '#EAB308', '#EF4444', '#A855F7', '#06B6D4'];

const STATUS_STACK = [
  { key: 'not_started', label: 'Запланировано', color: '#94A3B8' },
  { key: 'in_progress', label: 'В процессе', color: '#F59E0B' },
  { key: 'completed', label: 'Завершено', color: '#22C55E' },
] as const;

type ChecksAnalyticsDashboardProps = {
  checks: Check[];
};

function TreemapContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', fill = '#2563EB' } = props;
  if (width < 36 || height < 24) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />
      </g>
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={6} />
      <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={600}>
        {name.length > 18 ? `${name.slice(0, 16)}…` : name}
      </text>
    </g>
  );
}

export function ChecksAnalyticsDashboard({ checks }: ChecksAnalyticsDashboardProps) {
  const [granularity, setGranularity] = useState<PeriodGranularity>('quarter');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [auditorToAdd, setAuditorToAdd] = useState('');
  const [exportFormat, setExportFormat] = useState<AnalyticsExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  const exportSections = useExportSections(
    CHECK_EXPORT_SECTIONS.map((s) => s.id) as CheckExportSectionId[],
  );

  const leaderOptions = useMemo(() => {
    const names = collectCheckLeaders(checks);
    return names
      .filter((name) => !selectedAuditors.includes(name))
      .map((name) => ({ value: name, label: name }));
  }, [checks, selectedAuditors]);

  const filteredChecks = useMemo(
    () =>
      filterChecksForAnalytics(checks, {
        dateFrom,
        dateTo,
        auditors: selectedAuditors,
        granularity,
      }),
    [checks, dateFrom, dateTo, selectedAuditors, granularity],
  );

  const summary = useMemo(() => summarizeChecks(filteredChecks), [filteredChecks]);
  const completionShare = useMemo(() => buildCompletionShare(filteredChecks), [filteredChecks]);
  const periodSeries = useMemo(
    () => buildPeriodSeries(filteredChecks, granularity),
    [filteredChecks, granularity],
  );
  const cumulativeSeries = useMemo(
    () => buildCumulativeSeries(filteredChecks, granularity),
    [filteredChecks, granularity],
  );
  const statusDistribution = useMemo(
    () => buildStatusDistribution(filteredChecks),
    [filteredChecks],
  );
  const typeDistribution = useMemo(() => buildTypeDistribution(filteredChecks), [filteredChecks]);
  const viewDistribution = useMemo(() => buildViewDistribution(filteredChecks), [filteredChecks]);
  const auditorDistribution = useMemo(
    () => buildAuditorDistribution(filteredChecks),
    [filteredChecks],
  );
  const auditorMatrix = useMemo(
    () => buildAuditorPeriodMatrix(filteredChecks, granularity),
    [filteredChecks, granularity],
  );
  const durationDistribution = useMemo(
    () => buildDurationDistribution(filteredChecks),
    [filteredChecks],
  );
  const documentReadiness = useMemo(
    () => buildDocumentReadiness(filteredChecks),
    [filteredChecks],
  );
  const typeStatusBreakdown = useMemo(
    () => buildTypeStatusBreakdown(filteredChecks),
    [filteredChecks],
  );
  const viewRadar = useMemo(() => buildViewRadar(filteredChecks), [filteredChecks]);
  const maxAuditorCount = auditorDistribution[0]?.value ?? 1;

  const periodLabel =
    granularity === 'month' ? 'месяцам' : granularity === 'quarter' ? 'кварталам' : 'годам';

  const addAuditor = (value: string) => {
    if (!value || selectedAuditors.includes(value)) {
      return;
    }
    setSelectedAuditors((prev) => [...prev, value]);
    setAuditorToAdd('');
  };

  const removeAuditor = (value: string) => {
    setSelectedAuditors((prev) => prev.filter((item) => item !== value));
  };

  const resetFilters = () => {
    setGranularity('quarter');
    setDateFrom(null);
    setDateTo(null);
    setSelectedAuditors([]);
    setAuditorToAdd('');
  };

  const handleExport = async () => {
    if (filteredChecks.length === 0 || isExporting) {
      return;
    }
    if (exportSections.selectedSections.length === 0) {
      window.alert('Выберите хотя бы один дашборд для экспорта');
      return;
    }
    setIsExporting(true);
    try {
      await exportChecksDashboard(
        {
          checks,
          filteredChecks,
          granularity,
          dateFrom,
          dateTo,
          auditors: selectedAuditors,
          selectedSections: exportSections.selectedSections,
        },
        exportFormat,
      );
    } catch (error) {
      console.error('Analytics export failed', error);
      window.alert(
        `Не удалось экспортировать отчёт: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-left lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 space-y-3 lg:sticky lg:top-4 lg:w-72">
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-left dark:border-slate-700 dark:bg-slate-800/60">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-sber-dark dark:text-sber-light">
              Метрики и фильтры
            </h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Период</p>
              <SegmentedControl
                value={granularity}
                options={GRANULARITY_OPTIONS}
                onChange={setGranularity}
                className="w-full flex-col items-stretch"
                buttonClassName="min-w-0 w-full"
              />
            </div>
            <DatePicker
              label="Дата старта с"
              selected={dateFrom}
              onChange={setDateFrom}
              maxDate={dateTo}
              labelClassName="text-sm"
              inputClassName="py-1.5 text-sm"
            />
            <DatePicker
              label="Дата старта по"
              selected={dateTo}
              onChange={setDateTo}
              minDate={dateFrom}
              labelClassName="text-sm"
              inputClassName="py-1.5 text-sm"
            />
            <Select
              label="Добавить аудитора"
              value={auditorToAdd}
              onChange={addAuditor}
              options={leaderOptions}
              placeholder="Выберите из списка"
              className="w-full"
              labelClassName="text-sm"
              inputClassName="py-1.5 text-sm"
            />
            <Button
              variant="ghost"
              className="h-[38px] w-full px-3 text-sm"
              disabled={selectedAuditors.length === 0}
              onClick={() => setSelectedAuditors([])}
            >
              Очистить аудиторов
            </Button>
            {selectedAuditors.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedAuditors.map((auditor) => (
                  <span
                    key={auditor}
                    className="inline-flex items-center gap-1 rounded-lg border border-sber-dark/20 bg-white px-2 py-0.5 text-xs text-sber-dark dark:border-sber-light/30 dark:bg-slate-800 dark:text-sber-light"
                  >
                    {auditor}
                    <button
                      type="button"
                      onClick={() => removeAuditor(auditor)}
                      className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700"
                      aria-label={`Убрать ${auditor}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Аудиторы не выбраны — показаны все руководители.
              </p>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className={`${LIST_ACTION_BUTTON_CLASS} w-full border border-gray-300 bg-white text-gray-700 hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}
            >
              Сбросить фильтры
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-3.5 text-left dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-2 text-sm font-semibold text-sber-dark dark:text-sber-light">Экспорт</h3>
          <div className="space-y-2">
            <ExportSectionToolbar
              selectedCount={exportSections.selectedCount}
              totalCount={exportSections.totalCount}
              onSelectAll={exportSections.selectAll}
              onClearAll={exportSections.clearAll}
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={exportSections.isSelected('source')}
                onChange={() => exportSections.toggleSection('source')}
                className="h-3.5 w-3.5 accent-sber-dark"
              />
              Исходные данные в отчёт
            </label>
            <div className="flex flex-col gap-2">
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as AnalyticsExportFormat)}
                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {ANALYTICS_EXPORT_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || filteredChecks.length === 0}
                className={`${LIST_ACTION_BUTTON_CLASS} w-full gap-1.5 bg-[#90EE90] text-gray-800 hover:bg-[#7fdc7f] disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-900`}
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Экспорт...' : 'Экспорт'}
              </button>
            </div>
          </div>
        </section>
      </aside>

      <div className="min-w-0 flex-1 space-y-4 text-left">
      <ChartCard
        title="Сводка KPI"
        description="Ключевые показатели текущей выборки"
        exportSelected={exportSections.isSelected('summary')}
        onToggleExport={() => exportSections.toggleSection('summary')}
      >
        <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Всего" value={summary.total} hint={`из ${checks.length}`} tone="violet" />
          <KpiCard label="Запланировано" value={summary.not_started} tone="slate" />
          <KpiCard label="В процессе" value={summary.in_progress} tone="amber" />
          <KpiCard label="Завершено" value={summary.completed} tone="green" />
          <KpiCard label="Доля завершённых" value={completionShare} suffix="%" tone="blue" />
        </div>
      </ChartCard>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard
          title={`Динамика по ${periodLabel}`}
          description="Старты проверок в периоде"
          exportSelected={exportSections.isSelected('periods')}
          onToggleExport={() => exportSections.toggleSection('periods')}
        >
          {periodSeries.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={periodSeries} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="checksArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Проверки"
                    stroke="#003366"
                    fill="url(#checksArea)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Накопительный итог"
          description="Сколько проверок накопилось к концу периода"
          exportSelected={exportSections.isSelected('cumulative')}
          onToggleExport={() => exportSections.toggleSection('cumulative')}
        >
          {cumulativeSeries.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeSeries} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Накопительно"
                    stroke="#1D4ED8"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#003366' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title={`Статусы по ${periodLabel}`}
          description="Состав статусов внутри периода"
          exportSelected={exportSections.isSelected('statusByPeriod')}
          onToggleExport={() => exportSections.toggleSection('statusByPeriod')}
        >
          {periodSeries.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodSeries} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {STATUS_STACK.map((status) => (
                    <Bar
                      key={status.key}
                      dataKey={status.key}
                      name={status.label}
                      stackId="status"
                      fill={status.color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Тип × статус"
          description="Как статусы распределены по типам проверок"
          exportSelected={exportSections.isSelected('typeStatus')}
          onToggleExport={() => exportSections.toggleSection('typeStatus')}
        >
          {typeStatusBreakdown.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeStatusBreakdown} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {STATUS_STACK.map((status) => (
                    <Bar
                      key={status.key}
                      dataKey={status.key}
                      name={status.label}
                      stackId="typeStatus"
                      fill={status.color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ChartCard
          title="Статусы"
          description="Доли текущей выборки"
          exportSelected={exportSections.isSelected('statuses')}
          onToggleExport={() => exportSections.toggleSection('statuses')}
        >
          {statusDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-48" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_STACK[index]?.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Типы"
          description="Плановые / внеплановые / контрольные"
          exportSelected={exportSections.isSelected('types')}
          onToggleExport={() => exportSections.toggleSection('types')}
        >
          {typeDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-48" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={68}
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Виды (radar)"
          description="Профиль направлений проверок"
          exportSelected={exportSections.isSelected('views')}
          onToggleExport={() => exportSections.toggleSection('views')}
        >
          {viewRadar.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-48" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={viewRadar} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Radar
                    name="Проверки"
                    dataKey="value"
                    stroke="#003366"
                    fill="#6699FF"
                    fillOpacity={0.45}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard
          title="Нагрузка по аудиторам"
          description="Топ руководителей в выборке"
          exportSelected={exportSections.isSelected('auditors')}
          onToggleExport={() => exportSections.toggleSection('auditors')}
        >
          {auditorDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="space-y-2.5">
              {auditorDistribution.slice(0, 8).map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-gray-700 dark:text-slate-200">{item.name}</span>
                    <span className="tabular-nums font-medium text-sber-dark dark:text-sber-light">
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-sber-dark dark:bg-sber-light"
                      style={{ width: `${Math.max((item.value / maxAuditorCount) * 100, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Длительность проверок"
          description="По разнице даты старта и окончания"
          exportSelected={exportSections.isSelected('durations')}
          onToggleExport={() => exportSections.toggleSection('durations')}
        >
          {durationDistribution.length === 0 ? (
            <EmptyChart message="Нет данных с датой окончания" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationDistribution} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Проверки" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Готовность документов"
          description="Есть номер/дата приказа, программы, АЗ, ДЗ"
          exportSelected={exportSections.isSelected('documents')}
          onToggleExport={() => exportSections.toggleSection('documents')}
        >
          {documentReadiness.every((item) => item.filled === 0 && item.empty === 0) ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={documentReadiness} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="filled" name="Заполнено" stackId="docs" fill="#003366" />
                  <Bar dataKey="empty" name="Пусто" stackId="docs" fill="#E5E7EB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Виды проверок"
          description="ИТ, бизнес, риски и др."
          exportSelected={exportSections.isSelected('views')}
          onToggleExport={() => exportSections.toggleSection('views')}
        >
          {viewDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={viewDistribution}
                  layout="vertical"
                  margin={{ top: 6, right: 10, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Проверки" fill="#6699FF" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard
          title="Radial по статусам"
          description="Круговая шкала объёмов статусов"
          accentClassName="border-amber-200 dark:border-amber-900/40"
          exportSelected={exportSections.isSelected('statuses')}
          onToggleExport={() => exportSections.toggleSection('statuses')}
        >
          {statusDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="18%"
                  outerRadius="90%"
                  data={statusDistribution.map((item, index) => ({
                    ...item,
                    fill: STATUS_STACK.find((status) => status.label === item.name)?.color
                      ?? CHART_COLORS[index % CHART_COLORS.length],
                  }))}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar background dataKey="value" cornerRadius={6} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Treemap аудиторов"
          description="Площадь = число проверок руководителя"
          accentClassName="border-fuchsia-200 dark:border-fuchsia-900/40"
          exportSelected={exportSections.isSelected('auditors')}
          onToggleExport={() => exportSections.toggleSection('auditors')}
        >
          {auditorDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={auditorDistribution.slice(0, 10).map((item, index) => ({
                    name: item.name,
                    size: item.value,
                    fill: PALETTE[index % PALETTE.length],
                  }))}
                  dataKey="size"
                  stroke="#fff"
                  content={<TreemapContent />}
                />
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title={`Матрица: аудитор × ${periodLabel.slice(0, -2)}`}
        description="Кто сколько проверок стартовал в каждом периоде"
        className="overflow-hidden"
        accentClassName="border-indigo-200 dark:border-indigo-900/40"
        exportSelected={exportSections.isSelected('auditorMatrix')}
        onToggleExport={() => exportSections.toggleSection('auditorMatrix')}
      >
        {auditorMatrix.rows.length === 0 || auditorMatrix.periods.length === 0 ? (
          <EmptyChart message="Нет данных" heightClass="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-sber-dark text-left text-white">
                  <th className="px-2.5 py-1.5 font-medium">Руководитель</th>
                  {auditorMatrix.periods.map((period) => (
                    <th key={period.key} className="px-2.5 py-1.5 font-medium whitespace-nowrap">
                      {period.label}
                    </th>
                  ))}
                  <th className="px-2.5 py-1.5 font-medium">Итого</th>
                </tr>
              </thead>
              <tbody>
                {auditorMatrix.rows.map((row) => (
                  <tr
                    key={row.auditor}
                    className="border-b border-gray-100 dark:border-slate-700"
                  >
                    <td className="px-2.5 py-1.5 font-medium text-gray-800 dark:text-slate-100">
                      {row.auditor}
                    </td>
                    {auditorMatrix.periods.map((period) => {
                      const value = row.byPeriod[period.key] ?? 0;
                      return (
                        <td
                          key={period.key}
                          className={`px-2.5 py-1.5 tabular-nums ${
                            value > 0
                              ? 'bg-sber-light/15 text-sber-dark dark:bg-sber-light/10 dark:text-sber-light'
                              : 'text-gray-400'
                          }`}
                        >
                          {value || '—'}
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-1.5 font-semibold tabular-nums text-sber-dark dark:text-sber-light">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
      </div>
    </div>
  );
}
