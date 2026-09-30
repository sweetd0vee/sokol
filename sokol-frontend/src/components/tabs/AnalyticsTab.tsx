import { Suspense, useState, type ComponentType } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { LoadingState } from '../ui/StateMessage';
import { lazyNamed } from '../../utils/lazyNamed';

const ChecksAnalyticsDashboard = lazyNamed(
  () => import('../analytics/ChecksAnalyticsDashboard'),
  'ChecksAnalyticsDashboard',
);
const RecommendationsAnalyticsDashboard = lazyNamed(
  () => import('../analytics/RecommendationsAnalyticsDashboard'),
  'RecommendationsAnalyticsDashboard',
);
const MonitoringAnalyticsDashboard = lazyNamed(
  () => import('../analytics/MonitoringAnalyticsDashboard'),
  'MonitoringAnalyticsDashboard',
);
const DvaAnalyticsDashboard = lazyNamed(
  () => import('../analytics/DvaAnalyticsDashboard'),
  'DvaAnalyticsDashboard',
);

const ANALYTICS_TABS = [
  { value: 'checks' as const, label: 'Проверки', Panel: ChecksAnalyticsDashboard },
  { value: 'recommendations' as const, label: 'Рекомендации', Panel: RecommendationsAnalyticsDashboard },
  { value: 'monitoring' as const, label: 'Мониторинг', Panel: MonitoringAnalyticsDashboard },
  { value: 'dva' as const, label: 'ДВА', Panel: DvaAnalyticsDashboard },
] satisfies ReadonlyArray<{
  value: string;
  label: string;
  Panel: ComponentType;
}>;

type AnalyticsTabId = (typeof ANALYTICS_TABS)[number]['value'];

const PRIMARY_ANALYTICS_TABS = ANALYTICS_TABS.slice(0, 2).map(({ value, label }) => ({ value, label }));
const SECONDARY_ANALYTICS_TABS = ANALYTICS_TABS.slice(2).map(({ value, label }) => ({ value, label }));

export function AnalyticsTab() {
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('checks');
  const ActivePanel = ANALYTICS_TABS.find((tab) => tab.value === activeTab)?.Panel;

  return (
    <div className="w-full space-y-5 text-left">
      <div className="space-y-3">
        <PageHeader title="Аналитика" />
        <div className="space-y-2">
          <SegmentedControl
            value={activeTab}
            options={PRIMARY_ANALYTICS_TABS}
            onChange={setActiveTab}
          />
          <SegmentedControl
            value={activeTab}
            options={SECONDARY_ANALYTICS_TABS}
            onChange={setActiveTab}
          />
        </div>
      </div>

      {ActivePanel ? (
        <Suspense fallback={<LoadingState title="Загрузка дашборда…" />}>
          <ActivePanel />
        </Suspense>
      ) : null}
    </div>
  );
}
