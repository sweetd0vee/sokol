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
import {
  CHART_AXIS_TICK,
  CHART_CATEGORY_AXIS_TICK,
  ChartRechartsSquareLegend,
} from './AnalyticsChartPrimitives';
import {
  HORIZONTAL_BAR_MAX_SIZE,
  STACKED_HORIZONTAL_CHART_RIGHT_MARGIN,
  StackedBarSegmentValueLabel,
} from './StackedBarSegmentValueLabel';

export type AuditorBarSeries = {
  key: string;
  name: string;
  color: string;
};

type AuditorStackedBarChartProps = {
  data: Array<Record<string, string | number>>;
  series: AuditorBarSeries[];
  grouped?: boolean;
  totalKey?: string;
  categoryWidth?: number;
};

export function AuditorStackedBarChart({
  data,
  series,
  grouped = false,
  totalKey,
  categoryWidth = 128,
}: AuditorStackedBarChartProps) {
  const lastSeriesKey = series[series.length - 1]?.key;
  const stackKeys = series.map((item) => item.key);
  const colorByKey = Object.fromEntries(series.map((item) => [item.key, item.color]));

  return (
    <div className="h-full min-h-[10rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          barCategoryGap={10}
          maxBarSize={HORIZONTAL_BAR_MAX_SIZE}
          margin={{ top: 4, right: STACKED_HORIZONTAL_CHART_RIGHT_MARGIN, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
          <YAxis
            type="category"
            dataKey="name"
            width={categoryWidth}
            tick={CHART_CATEGORY_AXIS_TICK}
          />
          <Tooltip />
          <Legend content={<ChartRechartsSquareLegend />} />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name}
              stackId={grouped ? undefined : 'auditor'}
              fill={item.color}
              radius={grouped || item.key === lastSeriesKey ? [0, 4, 4, 0] : 0}
            >
              <LabelList
                dataKey={item.key}
                content={(props) => (
                  <StackedBarSegmentValueLabel
                    {...props}
                    dataKey={item.key}
                    stackKeys={stackKeys}
                    getColor={(key) => colorByKey[key] ?? item.color}
                    showStackTotal={Boolean(totalKey) && !grouped}
                    stackRow={data[Number(props.index)]}
                    layout="vertical"
                  />
                )}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
