import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { X } from 'lucide-react';
import type { MaterialityLevel, Recommendation } from '../../types/recommendation';
import { MATERIALITY_LEVEL_OPTIONS } from '../../constants/recommendations';
import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import { LIST_ACTION_BUTTON_CLASS } from '../../constants/formLayout';
import { ChartCard, EmptyChart, KpiCard, PALETTE } from './AnalyticsChartPrimitives';
import {
  ADDITIONAL_STATUS_COLORS,
  buildAdditionalStatusDistribution,
  buildAuditorDistribution,
  buildAuditorMaterialityRows,
  buildAuditorPeriodMatrix,
  buildAuditObjectDistribution,
  buildCheckLinkDistribution,
  buildCumulativeSeries,
  buildDeadlineBuckets,
  buildFunnel,
  buildIndicatorDistribution,
  buildManagerDistribution,
  buildMaterialityDistribution,
  buildMaterialityPeriodMatrix,
  buildPeriodSeries,
  buildRadialStatus,
  buildScatterPoints,
  buildStatusDistribution,
  buildTreemapData,
  collectRecommendationAuditors,
  filterRecommendationsForAnalytics,
  MATERIALITY_COLORS,
  STATUS_COLORS,
  summarizeRecommendations,
  type PeriodGranularity,
} from '../../utils/recommendationAnalytics';

const GRANULARITY_OPTIONS: { value: PeriodGranularity; label: string }[] = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

const STATUS_STACK = [
  { key: 'completed', label: 'Исполнено', color: STATUS_COLORS.completed },
  { key: 'in_progress', label: 'В процессе', color: STATUS_COLORS.in_progress },
  { key: 'on_control', label: 'На контроле', color: STATUS_COLORS.on_control },
  { key: 'unresolved', label: 'Не решено', color: STATUS_COLORS.unresolved },
] as const;

type RecommendationsAnalyticsDashboardProps = {
  recommendations: Recommendation[];
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
  if (width < 40 || height < 28) {
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
        {name.length > 22 ? `${name.slice(0, 20)}…` : name}
      </text>
    </g>
  );
}

export function RecommendationsAnalyticsDashboard({
  recommendations,
}: RecommendationsAnalyticsDashboardProps) {
  const [granularity, setGranularity] = useState<PeriodGranularity>('quarter');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [selectedMateriality, setSelectedMateriality] = useState<MaterialityLevel[]>([]);
  const [auditorToAdd, setAuditorToAdd] = useState('');

  const auditorOptions = useMemo(() => {
    return collectRecommendationAuditors(recommendations)
      .filter((name) => !selectedAuditors.includes(name))
      .map((name) => ({ value: name, label: name }));
  }, [recommendations, selectedAuditors]);

  const filtered = useMemo(
    () =>
      filterRecommendationsForAnalytics(recommendations, {
        dateFrom,
        dateTo,
        auditors: selectedAuditors,
        materialityLevels: selectedMateriality,
        granularity,
      }),
    [recommendations, dateFrom, dateTo, selectedAuditors, selectedMateriality, granularity],
  );

  const summary = useMemo(() => summarizeRecommendations(filtered), [filtered]);
  const periodSeries = useMemo(() => buildPeriodSeries(filtered, granularity), [filtered, granularity]);
  const cumulativeSeries = useMemo(
    () => buildCumulativeSeries(filtered, granularity),
    [filtered, granularity],
  );
  const statusDistribution = useMemo(() => buildStatusDistribution(filtered), [filtered]);
  const materialityDistribution = useMemo(() => buildMaterialityDistribution(filtered), [filtered]);
  const additionalStatusDistribution = useMemo(
    () => buildAdditionalStatusDistribution(filtered),
    [filtered],
  );
  const indicatorDistribution = useMemo(() => buildIndicatorDistribution(filtered), [filtered]);
  const auditorDistribution = useMemo(() => buildAuditorDistribution(filtered), [filtered]);
  const managerDistribution = useMemo(() => buildManagerDistribution(filtered), [filtered]);
  const auditObjectDistribution = useMemo(() => buildAuditObjectDistribution(filtered), [filtered]);
  const auditorMateriality = useMemo(() => buildAuditorMaterialityRows(filtered), [filtered]);
  const auditorMatrix = useMemo(
    () => buildAuditorPeriodMatrix(filtered, granularity),
    [filtered, granularity],
  );
  const materialityMatrix = useMemo(
    () => buildMaterialityPeriodMatrix(filtered, granularity),
    [filtered, granularity],
  );
  const deadlineBuckets = useMemo(() => buildDeadlineBuckets(filtered), [filtered]);
  const funnel = useMemo(() => buildFunnel(filtered), [filtered]);
  const scatterPoints = useMemo(() => buildScatterPoints(filtered), [filtered]);
  const treemapData = useMemo(() => buildTreemapData(filtered), [filtered]);
  const radialStatus = useMemo(() => buildRadialStatus(filtered), [filtered]);
  const checkLinks = useMemo(() => buildCheckLinkDistribution(filtered), [filtered]);
  const maxAuditor = auditorDistribution[0]?.value ?? 1;

  const periodLabel =
    granularity === 'month' ? 'месяцам' : granularity === 'quarter' ? 'кварталам' : 'годам';

  const toggleMateriality = (level: MaterialityLevel) => {
    setSelectedMateriality((prev) =>
      prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level],
    );
  };

  const addAuditor = (value: string) => {
    if (!value || selectedAuditors.includes(value)) {
      return;
    }
    setSelectedAuditors((prev) => [...prev, value]);
    setAuditorToAdd('');
  };

  const resetFilters = () => {
    setGranularity('quarter');
    setDateFrom(null);
    setDateTo(null);
    setSelectedAuditors([]);
    setSelectedMateriality([]);
    setAuditorToAdd('');
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-3.5 dark:border-violet-900/40 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800/80">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-sber-dark dark:text-sber-light">
              Фильтры рекомендаций
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Соберите выборку по сроку, аудиторам и существенности — все дашборды обновятся сразу.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className={`${LIST_ACTION_BUTTON_CLASS} border border-gray-300 bg-white text-gray-700 hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}
          >
            Сбросить
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Период срока</p>
            <SegmentedControl
              value={granularity}
              options={GRANULARITY_OPTIONS}
              onChange={setGranularity}
            />
          </div>
          <DatePicker
            label="Срок с"
            selected={dateFrom}
            onChange={setDateFrom}
            maxDate={dateTo}
            labelClassName="text-sm"
            inputClassName="py-1.5 text-sm"
          />
          <DatePicker
            label="Срок по"
            selected={dateTo}
            onChange={setDateTo}
            minDate={dateFrom}
            labelClassName="text-sm"
            inputClassName="py-1.5 text-sm"
          />
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Существенность</p>
          <div className="flex flex-wrap gap-2">
            {MATERIALITY_LEVEL_OPTIONS.map((option) => {
              const active =
                selectedMateriality.length === 0 || selectedMateriality.includes(option.value);
              const selected = selectedMateriality.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleMateriality(option.value)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                    selected
                      ? 'border-transparent text-white shadow-sm'
                      : active
                        ? 'border-gray-300 bg-white text-gray-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                        : 'border-gray-200 bg-gray-100 text-gray-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500'
                  }`}
                  style={
                    selected
                      ? { backgroundColor: MATERIALITY_COLORS[option.value] }
                      : undefined
                  }
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${option.dotClassName}`}
                    style={selected ? { backgroundColor: '#fff' } : undefined}
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {selectedMateriality.length === 0
              ? 'Все уровни существенности'
              : `Выбрано: ${selectedMateriality.map((level) => MATERIALITY_LEVEL_OPTIONS.find((item) => item.value === level)?.label).join(', ')}`}
          </p>
        </div>

        <div className="mt-3 space-y-2.5">
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Добавить аудитора"
              value={auditorToAdd}
              onChange={addAuditor}
              options={auditorOptions}
              placeholder="Выберите из списка"
              className="min-w-[220px] flex-1"
              labelClassName="text-sm"
              inputClassName="py-1.5 text-sm"
            />
            <Button
              variant="ghost"
              className="h-[38px] px-3 text-sm"
              disabled={selectedAuditors.length === 0}
              onClick={() => setSelectedAuditors([])}
            >
              Очистить
            </Button>
          </div>
          {selectedAuditors.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedAuditors.map((auditor, index) => (
                <span
                  key={auditor}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs text-white"
                  style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                >
                  {auditor}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAuditors((prev) => prev.filter((item) => item !== auditor))
                    }
                    className="rounded p-0.5 hover:bg-white/20"
                    aria-label={`Убрать ${auditor}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Аудиторы не выбраны — показаны все.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Всего" value={summary.total} hint={`из ${recommendations.length}`} tone="violet" />
        <KpiCard label="Исполнено" value={summary.byStatus.completed} tone="green" />
        <KpiCard label="Не решено" value={summary.byStatus.unresolved} tone="red" />
        <KpiCard label="Высокая сущ." value={summary.byMateriality.высокий} tone="amber" />
        <KpiCard label="Исполнение" value={summary.completionRate} suffix="%" tone="blue" />
        <KpiCard label="Нарушение срока" value={summary.violationRate} suffix="%" tone="red" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard
          title={`Динамика сроков по ${periodLabel}`}
          description="Сколько рекомендаций приходится на каждый период срока"
          accentClassName="border-sky-200 dark:border-sky-900/40"
        >
          {periodSeries.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={periodSeries} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="recArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" name="Рекомендации" stroke="#7C3AED" fill="url(#recArea)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Накопление и исполнение"
          description="Всего vs исполнено нарастающим итогом"
          accentClassName="border-emerald-200 dark:border-emerald-900/40"
        >
          {cumulativeSeries.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cumulativeSeries} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="За период" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="cumulative" name="Накопительно" stroke="#4F46E5" strokeWidth={2} />
                  <Line type="monotone" dataKey="cumulativeCompleted" name="Исполнено накопительно" stroke="#10B981" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title={`Существенность по ${periodLabel}`}
          description="Низкий / средний / высокий в динамике"
          accentClassName="border-rose-200 dark:border-rose-900/40"
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
                  <Bar dataKey="low" name="Низкий" stackId="mat" fill={MATERIALITY_COLORS.низкий} />
                  <Bar dataKey="medium" name="Средний" stackId="mat" fill={MATERIALITY_COLORS.средний} />
                  <Bar dataKey="high" name="Высокий" stackId="mat" fill={MATERIALITY_COLORS.высокий} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title={`Статусы по ${periodLabel}`}
          description="Цветной stacked по статусам исполнения"
          accentClassName="border-amber-200 dark:border-amber-900/40"
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
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ChartCard title="Существенность" description="Цвета уровней риска" accentClassName="border-green-200 dark:border-green-900/40">
          {materialityDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-48" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={materialityDistribution} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={40} outerRadius={68} paddingAngle={3}>
                    {materialityDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Статусы" description="Исполнено / не решено / контроль" accentClassName="border-yellow-200 dark:border-yellow-900/40">
          {statusDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-48" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={68}>
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Срок исполнения" description="В срок / нарушен / на контроле" accentClassName="border-pink-200 dark:border-pink-900/40">
          {additionalStatusDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-48" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={additionalStatusDistribution} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={36} outerRadius={68} paddingAngle={2}>
                    {additionalStatusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color ?? ADDITIONAL_STATUS_COLORS.on_control} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Индикаторы" description="Цветовые метки состояния" accentClassName="border-cyan-200 dark:border-cyan-900/40">
          {indicatorDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={indicatorDistribution} layout="vertical" margin={{ top: 6, right: 10, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Кол-во" radius={[0, 6, 6, 0]}>
                    {indicatorDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color ?? '#94A3B8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Горизонт сроков" description="Просрочка и ближайшие дедлайны" accentClassName="border-orange-200 dark:border-orange-900/40">
          {deadlineBuckets.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deadlineBuckets} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Рекомендации" radius={[6, 6, 0, 0]}>
                    {deadlineBuckets.map((entry) => (
                      <Cell key={entry.name} fill={entry.color ?? '#64748B'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Воронка исполнения" description="От общего объёма к закрытым" accentClassName="border-indigo-200 dark:border-indigo-900/40">
          {funnel.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="space-y-2.5">
              {funnel.map((step, index) => {
                const max = funnel[0]?.value || 1;
                return (
                  <div key={step.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 dark:text-slate-200">{step.name}</span>
                      <span className="font-semibold tabular-nums" style={{ color: step.color }}>
                        {step.value}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max((step.value / max) * 100, 8)}%`,
                          backgroundColor: step.color,
                          opacity: 1 - index * 0.08,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard
          title="Аудитор × существенность"
          description="Состав портфеля каждого аудитора по уровню риска"
          accentClassName="border-fuchsia-200 dark:border-fuchsia-900/40"
        >
          {auditorMateriality.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={auditorMateriality.slice(0, 10)} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="auditor" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={55} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="низкий" name="Низкий" stackId="am" fill={MATERIALITY_COLORS.низкий} />
                  <Bar dataKey="средний" name="Средний" stackId="am" fill={MATERIALITY_COLORS.средний} />
                  <Bar dataKey="высокий" name="Высокий" stackId="am" fill={MATERIALITY_COLORS.высокий} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Нагрузка аудиторов"
          description="Цветные progress-bars по количеству рекомендаций"
          accentClassName="border-blue-200 dark:border-blue-900/40"
        >
          {auditorDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="max-h-64 space-y-2.5 overflow-auto pr-1">
              {auditorDistribution.slice(0, 12).map((item, index) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-gray-700 dark:text-slate-200">{item.name}</span>
                    <span className="tabular-nums font-medium" style={{ color: PALETTE[index % PALETTE.length] }}>
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((item.value / maxAuditor) * 100, 4)}%`,
                        backgroundColor: PALETTE[index % PALETTE.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Радар статусов" description="Профиль статусов выборки" accentClassName="border-teal-200 dark:border-teal-900/40">
          {statusDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-52" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={statusDistribution}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Radar name="Кол-во" dataKey="value" stroke="#7C3AED" fill="#C4B5FD" fillOpacity={0.55} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Radial статусы" description="Круговая шкала объёмов" accentClassName="border-lime-200 dark:border-lime-900/40">
          {radialStatus.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-52" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="20%"
                  outerRadius="90%"
                  data={radialStatus.map((item, index) => ({
                    ...item,
                    fill: item.color ?? PALETTE[index % PALETTE.length],
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

        <ChartCard title="Scatter: объём vs высокий риск" description="Аудиторы: всего и высоких по существенности" accentClassName="border-red-200 dark:border-red-900/40">
          {scatterPoints.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-52" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" dataKey="total" name="Всего" tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="high" name="Высокий" tick={{ fontSize: 11 }} />
                  <ZAxis type="number" dataKey="violated" range={[60, 220]} name="Нарушения" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Аудиторы" data={scatterPoints} fill="#EF4444">
                    {scatterPoints.map((point) => (
                      <Cell
                        key={point.auditor}
                        fill={point.completionRate >= 70 ? '#22C55E' : point.completionRate >= 40 ? '#EAB308' : '#EF4444'}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Treemap: аудитор × существенность"
        description="Площадь блока = число рекомендаций, цвет = уровень существенности"
        accentClassName="border-purple-200 dark:border-purple-900/40"
      >
        {treemapData.length === 0 ? (
          <EmptyChart message="Нет данных" heightClass="h-64" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={treemapData} dataKey="size" stroke="#fff" content={<TreemapContent />} />
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="Объекты аудита" description="Где больше всего рекомендаций" accentClassName="border-sky-200 dark:border-sky-900/40">
          {auditObjectDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={auditObjectDistribution.slice(0, 8)} layout="vertical" margin={{ top: 6, right: 10, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Рекомендации" radius={[0, 6, 6, 0]}>
                    {auditObjectDistribution.slice(0, 8).map((entry, index) => (
                      <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Менеджеры" description="Распределение по ответственным менеджерам" accentClassName="border-violet-200 dark:border-violet-900/40">
          {managerDistribution.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={managerDistribution.slice(0, 8)} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Рекомендации" radius={[6, 6, 0, 0]}>
                    {managerDistribution.slice(0, 8).map((entry, index) => (
                      <Cell key={entry.name} fill={PALETTE[(index + 3) % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="По проверкам (serial)" description="Какие проверки дают больше рекомендаций" accentClassName="border-slate-200 dark:border-slate-700">
          {checkLinks.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={checkLinks} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="checkLinkArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" name="Рекомендации" stroke="#0891B2" fill="url(#checkLinkArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Исполнение по аудиторам" description="% закрытия и число нарушений срока" accentClassName="border-emerald-200 dark:border-emerald-900/40">
          {scatterPoints.length === 0 ? (
            <EmptyChart message="Нет данных" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={scatterPoints.slice(0, 10)} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="auditor" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={55} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="completionRate" name="% исполнения" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="violated" name="Нарушения" stroke="#EF4444" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {MATERIALITY_LEVEL_OPTIONS.map((option) => {
          const value = summary.byMateriality[option.value];
          const share = summary.total ? Math.round((value / summary.total) * 100) : 0;
          return (
            <div
              key={option.value}
              className="rounded-xl border p-3.5 text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${MATERIALITY_COLORS[option.value]}, ${MATERIALITY_COLORS[option.value]}CC)` }}
            >
              <p className="text-sm font-medium opacity-90">{option.label} уровень</p>
              <p className="mt-1 text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-xs opacity-90">{share}% выборки</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(share, 4)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <ChartCard
        title={`Матрица: аудитор × ${periodLabel.slice(0, -2)}`}
        description="Интенсивность по срокам — кто сколько рекомендаций ведёт"
        accentClassName="border-indigo-200 dark:border-indigo-900/40"
      >
        {auditorMatrix.rows.length === 0 || auditorMatrix.periods.length === 0 ? (
          <EmptyChart message="Нет данных" heightClass="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-indigo-700 text-left text-white">
                  <th className="px-2.5 py-1.5 font-medium">Аудитор</th>
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
                  <tr key={row.auditor} className="border-b border-gray-100 dark:border-slate-700">
                    <td className="px-2.5 py-1.5 font-medium text-gray-800 dark:text-slate-100">{row.auditor}</td>
                    {auditorMatrix.periods.map((period) => {
                      const value = row.byPeriod[period.key] ?? 0;
                      const intensity = Math.min(value / Math.max(row.total, 1), 1);
                      return (
                        <td
                          key={period.key}
                          className="px-2.5 py-1.5 tabular-nums"
                          style={
                            value > 0
                              ? {
                                  backgroundColor: `rgba(99, 102, 241, ${0.12 + intensity * 0.45})`,
                                  color: '#312E81',
                                }
                              : undefined
                          }
                        >
                          {value || '—'}
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-1.5 font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title={`Тепловая матрица существенности × ${periodLabel.slice(0, -2)}`}
        description="Как уровни риска распределены во времени"
        accentClassName="border-rose-200 dark:border-rose-900/40"
      >
        {materialityMatrix.rows.every((row) => row.total === 0) || materialityMatrix.periods.length === 0 ? (
          <EmptyChart message="Нет данных" heightClass="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-rose-700 text-left text-white">
                  <th className="px-2.5 py-1.5 font-medium">Существенность</th>
                  {materialityMatrix.periods.map((period) => (
                    <th key={period.key} className="px-2.5 py-1.5 font-medium whitespace-nowrap">
                      {period.label}
                    </th>
                  ))}
                  <th className="px-2.5 py-1.5 font-medium">Итого</th>
                </tr>
              </thead>
              <tbody>
                {materialityMatrix.rows.map((row) => (
                  <tr key={row.level} className="border-b border-gray-100 dark:border-slate-700">
                    <td className="px-2.5 py-1.5">
                      <span className="inline-flex items-center gap-2 font-medium text-gray-800 dark:text-slate-100">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                        {row.label}
                      </span>
                    </td>
                    {materialityMatrix.periods.map((period) => {
                      const value = row.byPeriod[period.key] ?? 0;
                      return (
                        <td
                          key={period.key}
                          className="px-2.5 py-1.5 tabular-nums font-medium"
                          style={
                            value > 0
                              ? { backgroundColor: `${row.color}33`, color: '#111827' }
                              : { color: '#9CA3AF' }
                          }
                        >
                          {value || '—'}
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-1.5 font-semibold tabular-nums" style={{ color: row.color }}>
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="На контроле" value={summary.byStatus.on_control} tone="slate" />
        <KpiCard label="В процессе" value={summary.byStatus.in_progress} tone="amber" />
        <KpiCard label="С продлениями" value={summary.withExtensions} tone="violet" />
        <KpiCard label="С датой закрытия" value={summary.withCompletionDate} tone="green" />
      </div>
    </div>
  );
}
