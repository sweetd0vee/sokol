import { PageHeader } from '../ui/PageHeader';
import { PlanningAnalyticsDashboard } from '../planning/PlanningAnalyticsDashboard';

export function PlanningTab() {
  return (
    <div className="w-full space-y-5 text-left">
      <PageHeader title="Планирование" />
      <PlanningAnalyticsDashboard />
    </div>
  );
}
