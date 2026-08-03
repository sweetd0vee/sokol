import { useState } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { useSokolData } from '../../contexts/sokolData';
import { ChecksAnalyticsDashboard } from '../analytics/ChecksAnalyticsDashboard';
import { RecommendationsAnalyticsDashboard } from '../analytics/RecommendationsAnalyticsDashboard';

const ANALYTICS_TABS = [
  { value: 'checks' as const, label: 'Проверки' },
  { value: 'recommendations' as const, label: 'Рекомендации' },
];

export function AnalyticsTab() {
  const [activeTab, setActiveTab] = useState<'checks' | 'recommendations'>('checks');
  const { checks, recommendations, isLoading, isError, error } = useSokolData();

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
        <RecommendationsAnalyticsDashboard recommendations={recommendations} />
      ) : null}
    </div>
  );
}
