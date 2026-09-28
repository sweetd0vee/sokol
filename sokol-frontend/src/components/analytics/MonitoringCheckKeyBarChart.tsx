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
import type { DeadlineExtensionByCheckRow } from '../../api/analytics';
import {
  CHART_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_VALUE_LABEL_SIZE,
  CHART_VALUE_LABEL_WEIGHT,
} from './AnalyticsChartPrimitives';
import { lastScaleColor, MONITORING_BAR_BLUE_SCALE } from './analyticsPalette';
import { CheckKeyAxisTick } from './CheckKeyAxisTick';
import { checkBarTooltipLabel } from './checkBarTooltip';

type ChartMargin = { top: number; right: number; left: number; bottom: number };

export function MonitoringCheckKeyBarChart({
  items,
  layout,
  shortNameByKey,
  colors,
  seriesName,
  minHeightClass,
  margin,
  barRadius,
  labelPosition,
  labelOffset,
}: {
  items: DeadlineExtensionByCheckRow[];
  layout: 'horizontal' | 'vertical';
  shortNameByKey: Map<string, string>;
  colors: string[];
  seriesName: string;
  minHeightClass: string;
  margin: ChartMargin;
  barRadius: [number, number, number, number];
  labelPosition: 'top' | 'right';
  labelOffset?: number;
}) {
  const fill = lastScaleColor(MONITORING_BAR_BLUE_SCALE);
  return (
    <div className={`h-full ${minHeightClass}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={items}
          {...(layout === 'vertical' ? { layout: 'vertical' as const } : {})}
          margin={margin}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          {layout === 'horizontal' ? (
            <XAxis
              dataKey="key"
              interval={0}
              height={36}
              tick={(props) => <CheckKeyAxisTick {...props} shortNameByKey={shortNameByKey} />}
            />
          ) : (
            <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} />
          )}
          {layout === 'horizontal' ? (
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          ) : (
            <YAxis
              dataKey="key"
              type="category"
              width={88}
              interval={0}
              tick={(props) => (
                <CheckKeyAxisTick {...props} orientation="left" shortNameByKey={shortNameByKey} />
              )}
            />
          )}
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => [value, seriesName]}
            labelFormatter={(label) => checkBarTooltipLabel(label, shortNameByKey)}
          />
          <Bar dataKey="value" name={seriesName} fill={fill} radius={barRadius}>
            {items.map((item, index) => (
              <Cell key={item.id} fill={colors[index]} />
            ))}
            <LabelList
              dataKey="value"
              position={labelPosition}
              fontSize={CHART_VALUE_LABEL_SIZE}
              fontWeight={CHART_VALUE_LABEL_WEIGHT}
              fill="#000000"
              {...(labelOffset === undefined ? {} : { offset: labelOffset })}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
