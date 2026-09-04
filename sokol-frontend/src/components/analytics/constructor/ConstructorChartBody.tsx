import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_AXIS_TICK,
  CHART_LEGEND_STYLE,
  CHART_TOOLTIP_STYLE,
  CHART_VALUE_LABEL_SIZE,
  ChartRechartsSquareLegend,
  EmptyChart,
  KpiCard,
} from '../AnalyticsChartPrimitives';
import { FocusableDonutChart } from '../FocusableDonutChart';
import { FocusableSquareCirclesChart } from '../FocusableSquareCirclesChart';
import { FocusableTreemapChart } from '../FocusableTreemapChart';
import { EffectivenessMatrixChart } from '../EffectivenessMatrixChart';
import { MaterialityMatrixChart } from '../MaterialityMatrixChart';
import { StatusMatrixChart } from '../StatusMatrixChart';
import { AuditorDocumentsMatrixChart } from '../AuditorDocumentsMatrixChart';
import {
  CHECKS_PALETTE,
  lastScaleColor,
  MONITORING_BAR_BLUE_SCALE,
  RECOMMENDATIONS_MATERIALITY_CHART_COLORS,
  VALUE_BLUE_SCALE,
  VALUE_EMERALD_SCALE,
  VALUE_GRAY_SCALE,
  VALUE_TEAL_SCALE,
} from '../analyticsPalette';
import {
  STACKED_HORIZONTAL_CHART_RIGHT_MARGIN,
  STACKED_PERIOD_CHART_SIDE_MARGIN,
  STACKED_PERIOD_CHART_TOP_MARGIN,
  StackedBarSegmentValueLabel,
} from '../StackedBarSegmentValueLabel';
import { distributionHasValues } from '../../../utils/analyticsDistribution';
import type { PeriodGranularity } from '../../../utils/checkAnalytics';
import type { ConstructorPayload } from './constructorTypes';

const QUARTER_AXIS_TICK = { fontSize: 12 } as const;
const MATERIALITY_STACK_KEYS = ['low', 'medium', 'high'] as const;

function periodXAxisProps(granularity?: PeriodGranularity) {
  if (granularity === 'quarter') {
    return {
      interval: 0 as const,
      height: 40,
      tickMargin: 8,
      minTickGap: 0,
      tick: { ...CHART_AXIS_TICK, fontSize: 12 },
    };
  }
  return {};
}

function getMaterialitySegmentColor(key: string) {
  if (key === 'low') {
    return RECOMMENDATIONS_MATERIALITY_CHART_COLORS.низкий;
  }
  if (key === 'medium') {
    return RECOMMENDATIONS_MATERIALITY_CHART_COLORS.средний;
  }
  if (key === 'high') {
    return RECOMMENDATIONS_MATERIALITY_CHART_COLORS.высокий;
  }
  return '#e5e7eb';
}

function checkBarTooltipLabel(label: unknown, shortNames: Record<string, string>) {
  const key = String(label);
  const shortName = shortNames[key];
  return shortName && shortName !== key ? `${key} — ${shortName}` : key;
}

function CheckKeyAxisTick({
  x = 0,
  y = 0,
  payload,
  shortNames,
  orientation = 'bottom',
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  shortNames: Record<string, string>;
  orientation?: 'bottom' | 'left';
}) {
  const key = String(payload?.value ?? '');
  const isLeft = orientation === 'left';
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{checkBarTooltipLabel(key, shortNames)}</title>
      <text
        x={isLeft ? -4 : 0}
        dy={isLeft ? 4 : 14}
        textAnchor={isLeft ? 'end' : 'middle'}
        fill="#64748B"
        fontSize={isLeft ? 11 : 9}
      >
        {key}
      </text>
    </g>
  );
}

export function ConstructorChartBody({ payload }: { payload: ConstructorPayload }) {
  if (payload.chart === 'kpi') {
    const columnsClass =
      payload.columns >= 6
        ? 'lg:grid-cols-6'
        : payload.columns === 5
          ? 'lg:grid-cols-5'
          : 'lg:grid-cols-4';
    return (
      <div className={`grid w-full grid-cols-2 gap-1 sm:grid-cols-3 ${columnsClass}`}>
        {payload.items.map((item) => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            hint={item.hint}
            suffix={item.suffix}
            tone={item.tone}
            accentColor={item.accentColor}
          />
        ))}
      </div>
    );
  }

  if (payload.chart === 'bar') {
    if (payload.data.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    const isBars = payload.variant === 'bars';
    return (
      <div className="h-full min-h-[13rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={payload.data}
            layout={isBars ? 'vertical' : 'horizontal'}
            margin={
              isBars
                ? { top: 8, right: 40, left: 16, bottom: 0 }
                : {
                    top: 22,
                    right: payload.granularity === 'quarter' ? 20 : 12,
                    left: payload.granularity === 'quarter' ? 8 : -10,
                    bottom: 0,
                  }
            }
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            {isBars ? (
              <>
                <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={payload.categoryWidth ?? 92}
                  tick={CHART_AXIS_TICK}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="label"
                  tick={payload.granularity === 'quarter' ? QUARTER_AXIS_TICK : CHART_AXIS_TICK}
                  interval={0}
                  minTickGap={0}
                  height={payload.granularity === 'quarter' ? 36 : 30}
                  padding={payload.granularity === 'quarter' ? { left: 10, right: 10 } : undefined}
                />
                <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
              </>
            )}
            <Tooltip itemStyle={{ color: '#003366' }} />
            <Bar
              dataKey="value"
              name={payload.seriesName}
              fill={payload.colors[0] ?? '#003366'}
              radius={isBars ? [0, 6, 6, 0] : [4, 4, 0, 0]}
            >
              {payload.data.map((item, index) => (
                <Cell key={`${item.label}-${index}`} fill={payload.colors[index] ?? payload.colors[0]} />
              ))}
              <LabelList
                dataKey="value"
                position={isBars ? 'right' : 'top'}
                fontSize={CHART_VALUE_LABEL_SIZE}
                fill={CHECKS_PALETTE[0]}
                offset={isBars ? 0 : 8}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (payload.chart === 'stacked') {
    if (payload.data.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    const stackKeys = payload.series.map((item) => item.key);
    const colorByKey = Object.fromEntries(payload.series.map((item) => [item.key, item.color]));
    const isVertical = payload.layout === 'vertical';
    const isGrouped = payload.grouped === true;
    const showSegmentLabels = payload.showStackTotal === true && !isGrouped;
    return (
      <div className="h-full min-h-[13rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={payload.data}
            layout={isVertical ? 'vertical' : 'horizontal'}
            margin={
              isVertical
                ? { top: 8, right: showSegmentLabels ? STACKED_HORIZONTAL_CHART_RIGHT_MARGIN : 24, left: 8, bottom: 0 }
                : {
                    top: STACKED_PERIOD_CHART_TOP_MARGIN,
                    right: STACKED_PERIOD_CHART_SIDE_MARGIN,
                    left: -10,
                    bottom: 0,
                  }
            }
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            {isVertical ? (
              <>
                <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                <YAxis
                  type="category"
                  dataKey={payload.xKey}
                  width={payload.categoryWidth ?? 120}
                  tick={CHART_AXIS_TICK}
                />
              </>
            ) : (
              <>
                <XAxis dataKey={payload.xKey} tick={CHART_AXIS_TICK} {...periodXAxisProps(payload.granularity)} />
                <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
              </>
            )}
            <Tooltip />
            {payload.showLegend ? <Legend content={<ChartRechartsSquareLegend />} /> : null}
            {payload.series.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.name}
                stackId={isGrouped ? undefined : 'stack'}
                fill={series.color}
                radius={isVertical ? [0, 4, 4, 0] : undefined}
              >
                {showSegmentLabels ? (
                  <LabelList
                    dataKey={series.key}
                    content={(props) => (
                      <StackedBarSegmentValueLabel
                        {...props}
                        dataKey={series.key}
                        stackKeys={stackKeys}
                        getColor={(key) => colorByKey[key] ?? series.color}
                        showStackTotal
                        stackRow={payload.data[Number(props.index)]}
                        layout={payload.layout ?? 'horizontal'}
                      />
                    )}
                  />
                ) : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (payload.chart === 'list') {
    if (payload.items.length === 0) {
      return <EmptyChart message={payload.emptyMessage ?? 'Нет данных'} />;
    }
    return (
      <div className="flex h-full min-h-[13rem] flex-col gap-2">
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
          <ol className="divide-y divide-slate-100">
            {payload.items.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-3 px-3 py-2 text-sm text-slate-700">
                <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                  {index + 1}
                </span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ol>
        </div>
        {payload.footer ? (
          <p className="shrink-0 text-sm font-semibold leading-snug text-sber-dark">{payload.footer}</p>
        ) : null}
      </div>
    );
  }

  if (payload.chart === 'donut') {
    if (!distributionHasValues(payload.data)) {
      return <EmptyChart message="Нет данных" />;
    }
    return (
      <FocusableDonutChart
        data={payload.data}
        palette={VALUE_BLUE_SCALE}
        colorByValue={payload.colorByValue}
        variant={payload.variant}
        labelMode={payload.labelMode ?? 'both'}
        legendPercentFirst={payload.legendPercentFirst}
        legendLayout={payload.legendLayout}
      />
    );
  }

  if (payload.chart === 'circles') {
    if (!distributionHasValues(payload.data)) {
      return <EmptyChart message="Нет данных" />;
    }
    return (
      <FocusableSquareCirclesChart
        data={payload.data}
        labelMode="both"
        legendLayout={payload.legendLayout}
      />
    );
  }

  if (payload.chart === 'treemap') {
    if (payload.data.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return (
      <FocusableTreemapChart
        data={payload.data}
        palette={
          payload.palette === 'gray'
            ? VALUE_GRAY_SCALE
            : payload.palette === 'emerald'
              ? VALUE_EMERALD_SCALE
              : payload.palette === 'teal'
                ? VALUE_TEAL_SCALE
                : VALUE_BLUE_SCALE
        }
        colorByValue
        colorByRank={payload.palette === 'emerald'}
        colorByUniqueValue={payload.palette === 'teal'}
      />
    );
  }

  if (payload.chart === 'effectiveness-matrix') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <EffectivenessMatrixChart rows={payload.rows} />;
  }

  if (payload.chart === 'materiality-matrix') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <MaterialityMatrixChart rows={payload.rows} />;
  }

  if (payload.chart === 'status-matrix') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <StatusMatrixChart rows={payload.rows} />;
  }

  if (payload.chart === 'auditor-documents-matrix') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <AuditorDocumentsMatrixChart rows={payload.rows} />;
  }

  if (payload.chart === 'materiality-combined') {
    return (
      <div className="relative flex h-full min-h-0 flex-row gap-2">
        <div className="min-h-0 min-w-0 flex-1">
          {distributionHasValues(payload.donut) ? (
            <FocusableDonutChart
              data={payload.donut}
              labelMode="both"
              legendLabelMode="name"
              showLegend={false}
              containerClassName="h-full min-h-0"
              valueLabelColor="#111827"
            />
          ) : (
            <EmptyChart message="Нет данных" heightClass="h-full" />
          )}
        </div>
        <div className="min-h-0 min-w-0" style={{ flex: 3 }}>
          {payload.series.length === 0 ? (
            <EmptyChart message="Нет данных" heightClass="h-full" />
          ) : (
            <div className="h-full min-h-0 pb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={payload.series}
                  margin={{
                    top: STACKED_PERIOD_CHART_TOP_MARGIN,
                    right: STACKED_PERIOD_CHART_SIDE_MARGIN,
                    left: -10,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...periodXAxisProps(payload.granularity)} />
                  <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
                  <Tooltip />
                  {MATERIALITY_STACK_KEYS.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={key === 'low' ? 'Низкий' : key === 'medium' ? 'Средний' : 'Высокий'}
                      stackId="mat"
                      fill={getMaterialitySegmentColor(key)}
                    >
                      <LabelList
                        dataKey={key}
                        content={(props) => (
                          <StackedBarSegmentValueLabel
                            {...props}
                            dataKey={key}
                            stackKeys={MATERIALITY_STACK_KEYS}
                            getColor={getMaterialitySegmentColor}
                            showStackTotal
                            stackRow={payload.series[Number(props.index)]}
                          />
                        )}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute bottom-1 left-1/2 flex -translate-x-1/2 flex-row items-center justify-center gap-6">
                {(
                  [
                    ['высокий', 'Высокий'],
                    ['средний', 'Средний'],
                    ['низкий', 'Низкий'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 text-sm text-black">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-sm"
                      style={{ backgroundColor: RECOMMENDATIONS_MATERIALITY_CHART_COLORS[key] }}
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (payload.chart === 'check-bars') {
    if (payload.data.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    const isBars = payload.variant === 'bars';
    return (
      <div className="h-full min-h-[14rem]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={payload.data}
            layout={isBars ? 'vertical' : 'horizontal'}
            margin={isBars ? { top: 8, right: 40, left: 8, bottom: 0 } : { top: 22, right: 16, left: -10, bottom: 28 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            {isBars ? (
              <>
                <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
                <YAxis
                  dataKey="key"
                  type="category"
                  width={88}
                  interval={0}
                  tick={(props) => (
                    <CheckKeyAxisTick
                      x={props.x}
                      y={props.y}
                      payload={props.payload}
                      orientation="left"
                      shortNames={payload.shortNames}
                    />
                  )}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="key"
                  interval={0}
                  height={36}
                  tick={(props) => (
                    <CheckKeyAxisTick
                      x={props.x}
                      y={props.y}
                      payload={props.payload}
                      shortNames={payload.shortNames}
                    />
                  )}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              </>
            )}
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => [value, payload.seriesName]}
              labelFormatter={(label) => checkBarTooltipLabel(label, payload.shortNames)}
            />
            <Bar
              dataKey="value"
              name={payload.seriesName}
              fill={lastScaleColor(MONITORING_BAR_BLUE_SCALE)}
              radius={isBars ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            >
              {payload.data.map((item, index) => (
                <Cell key={item.id} fill={payload.colors[index]} />
              ))}
              <LabelList
                dataKey="value"
                position={isBars ? 'right' : 'top'}
                fontSize={CHART_VALUE_LABEL_SIZE}
                fill={lastScaleColor(MONITORING_BAR_BLUE_SCALE)}
                offset={isBars ? 0 : 8}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (payload.data.length === 0) {
    return <EmptyChart message="Нет данных" />;
  }

  return (
    <div className="h-full min-h-[13rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={payload.data} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={CHART_AXIS_TICK} />
          <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} />
          <Tooltip />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Bar dataKey="filled" name="Готово" stackId="docs" fill="#22C55E">
            <LabelList dataKey="filled" position="center" fontSize={CHART_VALUE_LABEL_SIZE} fill="#fff" />
          </Bar>
          <Bar dataKey="empty" name="Не готово" stackId="docs" fill="#CBD5E1">
            <LabelList dataKey="empty" position="center" fontSize={CHART_VALUE_LABEL_SIZE} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
