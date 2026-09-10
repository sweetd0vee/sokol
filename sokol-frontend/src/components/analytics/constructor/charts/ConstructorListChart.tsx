import { EmptyChart } from '../../EmptyChart';
import type { ConstructorPayload } from '../constructorTypes';

export function ConstructorListChart({ payload }: { payload: Extract<ConstructorPayload, { chart: 'list' }> }) {
  if (payload.items.length === 0) {
    return <EmptyChart message={payload.emptyMessage ?? 'Нет данных'} />;
  }
  return (
    <div className="flex h-full min-h-0 max-h-[18rem] flex-col gap-2 lg:max-h-none">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
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
