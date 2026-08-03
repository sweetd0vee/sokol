import { useState } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { useSokolData } from '../../contexts/sokolData';
import { ChecksAnalyticsDashboard } from '../analytics/ChecksAnalyticsDashboard';

const ANALYTICS_TABS = [
  { value: 'checks' as const, label: 'Проверки' },
  { value: 'recommendations' as const, label: 'Рекомендации' },
];

export function AnalyticsTab() {
  const [activeTab, setActiveTab] = useState<'checks' | 'recommendations'>('checks');
  const { checks, isLoading, isError, error } = useSokolData();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Аналитика" />
        <SegmentedControl
          value={activeTab}
          options={ANALYTICS_TABS}
          onChange={setActiveTab}
        />
      </div>

      {isLoading ? <LoadingState title="Загрузка данных…" /> : null}
      {isError ? (
        <ErrorState
          title="Не удалось загрузить данные"
          description={error?.message ?? 'неизвестная ошибка'}
        />
      ) : null}

      {!isLoading && !isError && activeTab === 'checks' ? (
        <ChecksAnalyticsDashboard checks={checks} />
      ) : null}

      {!isLoading && !isError && activeTab === 'recommendations' ? (
        <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-slate-600 dark:bg-slate-800/40">
          <h3 className="text-base font-semibold text-sber-dark dark:text-sber-light">
            Дашборды по рекомендациям
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-slate-400">
            Следующий блок: динамика по срокам, статусам, материальности и аудиторам
            с теми же интерактивными фильтрами. Пока доступна аналитика по проверкам.
          </p>
        </section>
      ) : null}
    </div>
  );
}
