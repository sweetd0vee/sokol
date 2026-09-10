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
import { CHART_AXIS_TICK, CHART_LEGEND_STYLE, CHART_VALUE_LABEL_SIZE, CHART_VALUE_LABEL_WEIGHT } from '../../chartTokens';
import { EmptyChart } from '../../EmptyChart';
import type { ConstructorPayload } from '../constructorTypes';

export function ConstructorDocsStackedChart({
  payload,
}: {
  payload: Extract<ConstructorPayload, { chart: 'documents-closure' }>;
}) {
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
            <LabelList
              dataKey="filled"
              position="center"
              fontSize={CHART_VALUE_LABEL_SIZE}
              fontWeight={CHART_VALUE_LABEL_WEIGHT}
              fill="#fff"
            />
          </Bar>
          <Bar dataKey="empty" name="Не готово" stackId="docs" fill="#CBD5E1">
            <LabelList
              dataKey="empty"
              position="center"
              fontSize={CHART_VALUE_LABEL_SIZE}
              fontWeight={CHART_VALUE_LABEL_WEIGHT}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
