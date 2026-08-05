import { useState } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { useSokolData } from '../../contexts/sokolData';
import { ChecksAnalyticsDashboard } from '../analytics/ChecksAnalyticsDashboard';
import { RecommendationsAnalyticsDashboard } from '../analytics/RecommendationsAnalyticsDashboard';
import { MonitoringAnalyticsDashboard } from '../analytics/MonitoringAnalyticsDashboard';
import { DvaAnalyticsDashboard } from '../analytics/DvaAnalyticsDashboard';

const ANALYTICS_TABS = [
  { value: 'checks' as const, label: 'Проверки' },
  { value: 'recommendations' as const, label: 'Рекомендации' },
  { value: 'monitoring' as const, label: 'Мониторинг' },
  { value: 'dva' as const, label: 'ДВА' },
];

type AnalyticsTabId = (typeof ANALYTICS_TABS)[number]['value'];

export function AnalyticsTab() {
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('checks');
  const { checks, recommendations, isLoading, isError, error } = useSokolData();

  return (
    <div className="w-full space-y-5 text-left">
      <div className="space-y-3">
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
        <ChecksAnalyticsDashboard checks={checks} recommendations={recommendations} />
      ) : null}

      {!isLoading && !isError && activeTab === 'recommendations' ? (
        <RecommendationsAnalyticsDashboard recommendations={recommendations} />
      ) : null}

      {!isLoading && !isError && activeTab === 'monitoring' ? (
        <MonitoringAnalyticsDashboard recommendations={recommendations} />
      ) : null}

      {!isLoading && !isError && activeTab === 'dva' ? (
        <DvaAnalyticsDashboard checks={checks} recommendations={recommendations} />
      ) : null}
    </div>
  );
}
