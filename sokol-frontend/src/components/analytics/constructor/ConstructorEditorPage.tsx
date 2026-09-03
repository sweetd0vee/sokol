import { useLayoutEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LoadingState } from '../../ui/StateMessage';
import { ConstructorDashboard } from './ConstructorDashboard';
import { ConstructorNameModal } from './ConstructorNameModal';
import { useAnalyticsConstructor } from './analyticsConstructorState';
import { FORM_OUTLINE_BUTTON_CLASS } from '../../../constants/formLayout';

export function ConstructorEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dashboards, activeDashboard, setActiveDashboard, renameDashboard } = useAnalyticsConstructor();
  const [renameValue, setRenameValue] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!id) {
      navigate('/constructor', { replace: true });
      return;
    }
    const found = dashboards.some((item) => item.id === id);
    if (!found) {
      navigate('/constructor', { replace: true });
      return;
    }
    setActiveDashboard(id);
  }, [dashboards, id, navigate, setActiveDashboard]);

  if (!id || !activeDashboard || activeDashboard.id !== id) {
    return <LoadingState title="Загрузка дашборда…" />;
  }

  return (
    <div className="w-full space-y-5 text-left">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-sber-dark">{activeDashboard.name}</h2>
          <button
            type="button"
            onClick={() => setRenameValue(activeDashboard.name)}
            className="mt-1 text-sm font-medium text-[#6699FF] hover:text-[#3B82F6]"
          >
            Переименовать
          </button>
        </div>
        <Link to="/constructor" className={FORM_OUTLINE_BUTTON_CLASS}>
          К списку дашбордов
        </Link>
      </div>
      <ConstructorDashboard />
      {renameValue !== null ? (
        <ConstructorNameModal
          title="Название дашборда"
          submitLabel="Сохранить"
          value={renameValue}
          onChange={setRenameValue}
          onClose={() => setRenameValue(null)}
          onSubmit={() => {
            renameDashboard(activeDashboard.id, renameValue);
            setRenameValue(null);
          }}
        />
      ) : null}
    </div>
  );
}
