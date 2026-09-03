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
  CHART_VALUE_LABEL_SIZE,
  ChartRechartsSquareLegend,
} from './AnalyticsChartPrimitives';

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

  return (
    <div className="h-full min-h-[13rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 36, left: 8, bottom: 0 }}>
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
              radius={[0, 4, 4, 0]}
            >
              {totalKey && item.key === lastSeriesKey ? (
                <LabelList
                  dataKey={totalKey}
                  position="right"
                  fontSize={CHART_VALUE_LABEL_SIZE}
                  fill="#0F172A"
                />
              ) : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
