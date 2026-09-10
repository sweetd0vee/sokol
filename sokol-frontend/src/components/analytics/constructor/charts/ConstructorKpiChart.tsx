import { KpiCard } from '../../KpiCard';
import type { ConstructorPayload } from '../constructorTypes';

export function ConstructorKpiChart({ payload }: { payload: Extract<ConstructorPayload, { chart: 'kpi' }> }) {
  const columnsClass =
    payload.columns >= 6
      ? 'lg:grid-cols-6'
      : payload.columns === 5
        ? 'lg:grid-cols-5'
        : payload.columns === 3
          ? 'lg:grid-cols-3'
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
