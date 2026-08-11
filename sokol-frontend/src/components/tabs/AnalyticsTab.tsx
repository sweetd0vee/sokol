import { useState } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
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

      {activeTab === 'checks' ? <ChecksAnalyticsDashboard /> : null}
      {activeTab === 'recommendations' ? <RecommendationsAnalyticsDashboard /> : null}
      {activeTab === 'monitoring' ? <MonitoringAnalyticsDashboard /> : null}
      {activeTab === 'dva' ? <DvaAnalyticsDashboard /> : null}
    </div>
  );
}
