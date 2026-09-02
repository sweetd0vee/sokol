import { useState, type ReactNode } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ChecksAnalyticsDashboard } from '../analytics/ChecksAnalyticsDashboard';
import { RecommendationsAnalyticsDashboard } from '../analytics/RecommendationsAnalyticsDashboard';
import { MonitoringAnalyticsDashboard } from '../analytics/MonitoringAnalyticsDashboard';
import { DvaAnalyticsDashboard } from '../analytics/DvaAnalyticsDashboard';
import { AnalyticsConstructorProvider } from '../analytics/constructor/AnalyticsConstructorContext';
import { useAnalyticsConstructor } from '../analytics/constructor/analyticsConstructorState';
import { ConstructorDashboard } from '../analytics/constructor/ConstructorDashboard';

const ANALYTICS_TABS = [
  { value: 'checks' as const, label: 'Проверки' },
  { value: 'recommendations' as const, label: 'Рекомендации' },
  { value: 'monitoring' as const, label: 'Мониторинг' },
  { value: 'dva' as const, label: 'ДВА' },
  { value: 'constructor' as const, label: 'Конструктор' },
];

type AnalyticsTabId = (typeof ANALYTICS_TABS)[number]['value'];

const PRIMARY_ANALYTICS_TABS = ANALYTICS_TABS.slice(0, 2);
const SECONDARY_ANALYTICS_TABS = ANALYTICS_TABS.slice(2, 4);

function KeepAlivePanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className={active ? 'w-full' : 'hidden'}>{children}</div>;
}

function AnalyticsTabInner() {
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('checks');
  const [visited, setVisited] = useState<Set<AnalyticsTabId>>(() => new Set(['checks']));
  const { widgets } = useAnalyticsConstructor();

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
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={activeTab}
              options={SECONDARY_ANALYTICS_TABS}
              onChange={openTab}
            />
            <button
              type="button"
              onClick={() => openTab('constructor')}
              className={`inline-flex min-w-[156px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium transition ${
                activeTab === 'constructor'
                  ? 'bg-sber-dark text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Конструктор
              {widgets.length > 0 ? (
                <span
                  className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                    activeTab === 'constructor' ? 'bg-white/20 text-white' : 'bg-sber-dark text-white'
                  }`}
                >
                  {widgets.length}
                </span>
              ) : null}
            </button>
          </div>
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
      {activeTab === 'constructor' ? <ConstructorDashboard /> : null}
    </div>
  );
}

export function AnalyticsTab() {
  return (
    <AnalyticsConstructorProvider>
      <AnalyticsTabInner />
    </AnalyticsConstructorProvider>
  );
}
