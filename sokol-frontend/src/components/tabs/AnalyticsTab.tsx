import { useState, type ComponentType, type ReactNode } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ChecksAnalyticsDashboard } from '../analytics/ChecksAnalyticsDashboard';
import { RecommendationsAnalyticsDashboard } from '../analytics/RecommendationsAnalyticsDashboard';
import { MonitoringAnalyticsDashboard } from '../analytics/MonitoringAnalyticsDashboard';
import { DvaAnalyticsDashboard } from '../analytics/DvaAnalyticsDashboard';

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

      {ANALYTICS_TABS.map(({ value, Panel }) =>
        visited.has(value) ? (
          <KeepAlivePanel key={value} active={activeTab === value}>
            <Panel />
          </KeepAlivePanel>
        ) : null,
      )}
    </div>
  );
}
