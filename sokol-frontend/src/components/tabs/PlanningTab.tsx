import { PageHeader } from '../ui/PageHeader';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { useSokolData } from '../../contexts/sokolData';
import { PlanningAnalyticsDashboard } from '../planning/PlanningAnalyticsDashboard';

export function PlanningTab() {
  const { checks, recommendations, isLoading, isError, error } = useSokolData();

  return (
    <div className="w-full space-y-5 text-left">
      <PageHeader title="Планирование" />

      {isLoading ? <LoadingState title="Загрузка данных…" /> : null}
      {isError ? (
        <ErrorState
          title="Не удалось загрузить данные"
          description={error?.message ?? 'неизвестная ошибка'}
        />
      ) : null}

      {!isLoading && !isError ? (
        <PlanningAnalyticsDashboard checks={checks} recommendations={recommendations} />
      ) : null}
    </div>
  );
}
