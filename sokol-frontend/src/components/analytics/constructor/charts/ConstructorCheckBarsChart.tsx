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
import { CHART_AXIS_TICK, CHART_TOOLTIP_STYLE, CHART_VALUE_LABEL_SIZE, CHART_VALUE_LABEL_WEIGHT } from '../../chartTokens';
import { CheckKeyAxisTick } from '../../CheckKeyAxisTick';
import { checkBarTooltipLabel } from '../../checkBarTooltip';
import { lastScaleColor, MONITORING_BAR_BLUE_SCALE } from '../../analyticsPalette';
import { EmptyChart } from '../../EmptyChart';
import type { ConstructorPayload } from '../constructorTypes';

export function ConstructorCheckBarsChart({
  payload,
}: {
  payload: Extract<ConstructorPayload, { chart: 'check-bars' }>;
}) {
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
            radius={isBars ? [0, 6, 6, 0] : [4, 4, 0, 0]}
          >
            {payload.data.map((item, index) => (
              <Cell key={item.id} fill={payload.colors[index]} />
            ))}
            <LabelList
              dataKey="value"
              position={isBars ? 'right' : 'top'}
              fontSize={CHART_VALUE_LABEL_SIZE}
              fontWeight={CHART_VALUE_LABEL_WEIGHT}
              fill="#000000"
              offset={isBars ? 0 : 8}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
