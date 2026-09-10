import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHECKS_PALETTE } from '../../analyticsPalette';
import { CHART_AXIS_TICK, CHART_VALUE_LABEL_SIZE, CHART_VALUE_LABEL_WEIGHT } from '../../chartTokens';
import { HORIZONTAL_STRIP_MAX_SIZE } from '../../StackedBarSegmentValueLabel';
import { EmptyChart } from '../../EmptyChart';
import { withYearChartLabels } from '../constructorPeriodLabels';
import type { ConstructorPayload } from '../constructorTypes';

const QUARTER_AXIS_TICK = { fontSize: 12 } as const;

export function ConstructorBarChart({ payload }: { payload: Extract<ConstructorPayload, { chart: 'bar' }> }) {
  if (payload.data.length === 0) {
    return <EmptyChart message="Нет данных" />;
  }
  const isBars = payload.variant === 'bars';
  const barData = withYearChartLabels(payload.data, payload.granularity);
  return (
    <div className="h-full min-h-[13rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={barData}
          layout={isBars ? 'vertical' : 'horizontal'}
          barCategoryGap={isBars ? '36%' : undefined}
          maxBarSize={isBars ? HORIZONTAL_STRIP_MAX_SIZE : undefined}
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
              fontWeight={CHART_VALUE_LABEL_WEIGHT}
              fill={CHECKS_PALETTE[0]}
              offset={isBars ? 0 : 8}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
