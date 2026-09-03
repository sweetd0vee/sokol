import { useLayoutEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LoadingState } from '../../ui/StateMessage';
import { ConstructorDashboard } from './ConstructorDashboard';
import { ConstructorNameModal } from './ConstructorNameModal';
import { useAnalyticsConstructor } from './analyticsConstructorState';
import { FORM_OUTLINE_BUTTON_CLASS } from '../../../constants/formLayout';

export function ConstructorEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dashboards, activeDashboardId, setActiveDashboard, renameDashboard } = useAnalyticsConstructor();
  const [renameValue, setRenameValue] = useState<string | null>(null);
  const dashboard = useMemo(
    () => dashboards.find((item) => item.id === id) ?? null,
    [dashboards, id],
  );
  const isCurrent = Boolean(dashboard && dashboard.id === activeDashboardId);

  useLayoutEffect(() => {
    if (!id) {
      navigate('/constructor', { replace: true });
      return;
    }
    if (!dashboards.some((item) => item.id === id)) {
      navigate('/constructor', { replace: true });
    }
  }, [dashboards, id, navigate]);

  if (!id || !dashboard) {
    return <LoadingState title="Загрузка дашборда…" />;
  }

  return (
    <div className="w-full space-y-5 text-left">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-sber-dark">{dashboard.name}</h2>
            {isCurrent ? (
              <span className="rounded-full bg-sber-dark/10 px-2 py-0.5 text-[11px] font-medium text-sber-dark">
                Текущий
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setActiveDashboard(dashboard.id)}
                className="rounded-full border border-sber-dark/25 px-2 py-0.5 text-[11px] font-medium text-gray-500 transition hover:border-sber-dark hover:text-sber-dark"
              >
                Сделать текущим
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRenameValue(dashboard.name)}
            className="mt-1 text-sm font-medium text-[#6699FF] hover:text-[#3B82F6]"
          >
            Переименовать
          </button>
        </div>
        <Link to="/constructor" className={FORM_OUTLINE_BUTTON_CLASS}>
          К списку дашбордов
        </Link>
      </div>
      <ConstructorDashboard dashboardId={dashboard.id} />
      {renameValue !== null ? (
        <ConstructorNameModal
          title="Название дашборда"
          submitLabel="Сохранить"
          value={renameValue}
          onChange={setRenameValue}
          onClose={() => setRenameValue(null)}
          onSubmit={() => {
            renameDashboard(dashboard.id, renameValue);
            setRenameValue(null);
          }}
        />
      ) : null}
    </div>
  );
}
