import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_AXIS_TICK } from '../../chartTokens';
import { ChartRechartsSquareLegend } from '../../ChartLegend';
import { getPeriodXAxisProps } from '../../analyticsChartAxis';
import {
  STACKED_HORIZONTAL_CHART_RIGHT_MARGIN,
  STACKED_PERIOD_CHART_SIDE_MARGIN,
  STACKED_PERIOD_CHART_TOP_MARGIN,
  StackedBarSegmentValueLabel,
} from '../../StackedBarSegmentValueLabel';
import { EmptyChart } from '../../EmptyChart';
import { withYearChartField } from '../constructorPeriodLabels';
import type { ConstructorPayload } from '../constructorTypes';

export function ConstructorStackedChart({
  payload,
}: {
  payload: Extract<ConstructorPayload, { chart: 'stacked' }>;
}) {
  if (payload.data.length === 0) {
    return <EmptyChart message="Нет данных" />;
  }
  const stackedData = withYearChartField(payload.data, payload.xKey, payload.granularity);
  const stackKeys = payload.series.map((item) => item.key);
  const colorByKey = Object.fromEntries(payload.series.map((item) => [item.key, item.color]));
  const isVertical = payload.layout === 'vertical';
  const isGrouped = payload.grouped === true;
  const showSegmentLabels = payload.showStackTotal === true && !isGrouped;
  return (
    <div className="h-full min-h-[10rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={stackedData}
          layout={isVertical ? 'vertical' : 'horizontal'}
          barCategoryGap={isVertical ? 4 : undefined}
          maxBarSize={isVertical ? 36 : undefined}
          margin={
            isVertical
              ? { top: 4, right: showSegmentLabels ? STACKED_HORIZONTAL_CHART_RIGHT_MARGIN : 24, left: 8, bottom: 0 }
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
              <XAxis dataKey={payload.xKey} tick={CHART_AXIS_TICK} {...getPeriodXAxisProps(payload.granularity)} />
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
                      stackRow={stackedData[Number(props.index)]}
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
