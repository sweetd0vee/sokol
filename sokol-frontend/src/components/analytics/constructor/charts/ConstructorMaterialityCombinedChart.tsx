import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_AXIS_TICK } from '../../chartTokens';
import { getMaterialitySegmentColor, getPeriodXAxisProps, MATERIALITY_STACK_KEYS } from '../../analyticsChartAxis';
import { FocusableDonutChart } from '../../FocusableDonutChart';
import { RECOMMENDATIONS_MATERIALITY_CHART_COLORS } from '../../analyticsPalette';
import {
  STACKED_PERIOD_CHART_SIDE_MARGIN,
  STACKED_PERIOD_CHART_TOP_MARGIN,
  StackedBarSegmentValueLabel,
} from '../../StackedBarSegmentValueLabel';
import { distributionHasValues } from '../../../../utils/analyticsDistribution';
import { EmptyChart } from '../../EmptyChart';
import type { ConstructorPayload } from '../constructorTypes';

export function ConstructorMaterialityCombinedChart({
  payload,
}: {
  payload: Extract<ConstructorPayload, { chart: 'materiality-combined' }>;
}) {
  return (
    <div className="relative flex h-full min-h-0 flex-row gap-2">
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
                <XAxis dataKey="label" tick={CHART_AXIS_TICK} {...getPeriodXAxisProps(payload.granularity)} />
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
    </div>
  );
}
