import { useState, type ReactNode } from 'react';
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

const PRIMARY_ANALYTICS_TABS = ANALYTICS_TABS.slice(0, 2);
const SECONDARY_ANALYTICS_TABS = ANALYTICS_TABS.slice(2);

function KeepAlivePanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className={active ? 'w-full' : 'hidden'}>{children}</div>;
}

export function AnalyticsTab() {
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('checks');
  const [visited, setVisited] = useState<Set<AnalyticsTabId>>(() => new Set(['checks']));

  const openTab = (next: AnalyticsTabId) => {
    setActiveTab(next);
    setVisited((prev) => {
      if (prev.has(next)) {
        return prev;
      }
      const copy = new Set(prev);
      copy.add(next);
      return copy;
    });
  };

  return (
    <div className="w-full space-y-5 text-left">
      <div className="space-y-3">
        <PageHeader title="Аналитика" />
        <div className="space-y-2">
          <SegmentedControl
            value={activeTab}
            options={PRIMARY_ANALYTICS_TABS}
            onChange={openTab}
          />
          <SegmentedControl
            value={activeTab}
            options={SECONDARY_ANALYTICS_TABS}
            onChange={openTab}
          />
        </div>
      </div>

      {visited.has('checks') ? (
        <KeepAlivePanel active={activeTab === 'checks'}>
          <ChecksAnalyticsDashboard />
        </KeepAlivePanel>
      ) : null}
      {visited.has('recommendations') ? (
        <KeepAlivePanel active={activeTab === 'recommendations'}>
          <RecommendationsAnalyticsDashboard />
        </KeepAlivePanel>
      ) : null}
      {visited.has('monitoring') ? (
        <KeepAlivePanel active={activeTab === 'monitoring'}>
          <MonitoringAnalyticsDashboard />
        </KeepAlivePanel>
      ) : null}
      {visited.has('dva') ? (
        <KeepAlivePanel active={activeTab === 'dva'}>
          <DvaAnalyticsDashboard />
        </KeepAlivePanel>
      ) : null}
    </div>
  );
}
