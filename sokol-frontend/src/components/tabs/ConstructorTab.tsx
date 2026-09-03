import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, Download, LayoutDashboard, MoreHorizontal, PencilLine, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState } from '../ui/StateMessage';
import { ConfirmDialog } from '../ui/Modal';
import { LIST_CHROME_RIGHT_INSET_CLASS } from '../../constants/formLayout';
import { useAnalyticsConstructor } from '../analytics/constructor/analyticsConstructorState';
import { ConstructorNameModal } from '../analytics/constructor/ConstructorNameModal';
import { CONSTRUCTOR_SOURCE_LABELS } from '../analytics/constructor/constructorTypes';
import { defaultDashboardName } from '../analytics/constructor/constructorLibrary';

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('ru-RU');
}

function sourceSummary(kinds: string[]) {
  if (kinds.length === 0) {
    return 'Пустой лист';
  }
  return kinds
    .map((kind) => CONSTRUCTOR_SOURCE_LABELS[kind as keyof typeof CONSTRUCTOR_SOURCE_LABELS] ?? kind)
    .join(', ');
}

export function ConstructorTab() {
  const navigate = useNavigate();
  const {
    dashboards,
    activeDashboardId,
    createDashboard,
    duplicateDashboard,
    deleteDashboard,
    setActiveDashboard,
  } = useAnalyticsConstructor();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [saveAsId, setSaveAsId] = useState<string | null>(null);
  const [saveAsName, setSaveAsName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const sortedDashboards = useMemo(
    () => [...dashboards].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [dashboards],
  );
  const deleteTarget = dashboards.find((item) => item.id === deleteId);

  useEffect(() => {
    if (!openMenuId) {
      return undefined;
    }
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const openCreate = () => {
    setCreateName(defaultDashboardName());
    setIsCreateOpen(true);
  };

  const handleCreate = () => {
    const record = createDashboard(createName);
    setIsCreateOpen(false);
    setCreateName('');
    navigate(`/constructor/${record.id}`);
  };

  const handleSaveAs = () => {
    if (!saveAsId) {
      return;
    }
    const record = duplicateDashboard(saveAsId, saveAsName);
    setSaveAsId(null);
    setSaveAsName('');
    if (record) {
      navigate(`/constructor/${record.id}`);
    }
  };

  return (
    <div className="w-full space-y-5 text-left">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Конструктор дашбордов" />
        <div className={`mx-auto flex shrink-0 items-center sm:mx-0 ${LIST_CHROME_RIGHT_INSET_CLASS}`}>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-[38px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#90EE90] px-4 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f]"
          >
            <Plus size={16} />
            Создать дашборд
          </button>
        </div>
      </div>

      {sortedDashboards.length === 0 ? (
        <EmptyState
          title="Пока нет дашбордов"
          description="Создайте лист или добавьте график из аналитики / планирования — появится черновик в этой истории."
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-base">
            <thead>
              <tr className="bg-[#003366] text-white">
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Графиков</th>
                <th className="px-4 py-3 font-medium">Источники</th>
                <th className="px-4 py-3 font-medium">Изменён</th>
                <th className="px-4 py-3 font-medium">Создан</th>
                <th className="px-0 pr-4 py-3 text-center font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedDashboards.map((dashboard) => {
                const kinds = [...new Set(dashboard.widgets.map((widget) => widget.kind))];
                const isActive = dashboard.id === activeDashboardId;
                return (
                  <tr key={dashboard.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 shrink-0 text-sber-dark" />
                        <Link
                          to={`/constructor/${dashboard.id}`}
                          className="font-medium text-sber-dark hover:underline"
                        >
                          {dashboard.name}
                        </Link>
                        {isActive ? (
                          <span className="shrink-0 rounded-full bg-sber-dark/10 px-2 py-0.5 text-[11px] font-medium text-sber-dark">
                            Текущий
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{dashboard.widgets.length}</td>
                    <td className="px-4 py-3 text-gray-600">{sourceSummary(kinds)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(dashboard.updatedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(dashboard.createdAt)}</td>
                    <td className="overflow-visible px-0 pr-4 py-3">
                      <div className="relative ml-auto flex w-20 items-center justify-end gap-1">
                        <Link
                          to={`/constructor/${dashboard.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#003366] transition hover:bg-gray-100"
                          aria-label={`Редактировать «${dashboard.name}»`}
                          title="Редактировать"
                        >
                          <PencilLine size={16} />
                        </Link>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId((current) => (current === dashboard.id ? null : dashboard.id));
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#003366] transition hover:bg-gray-100"
                          aria-expanded={openMenuId === dashboard.id}
                          aria-label={`Ещё действия для «${dashboard.name}»`}
                          title="Ещё"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {openMenuId === dashboard.id ? (
                          <div
                            className="absolute right-0 top-9 z-30 w-52 rounded-lg border border-gray-200 bg-white py-1 text-gray-900 shadow-lg"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {isActive ? null : (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                                onClick={() => {
                                  setActiveDashboard(dashboard.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Check size={14} />
                                <span>Сделать текущим</span>
                              </button>
                            )}
                            <Link
                              to={`/constructor/${dashboard.id}`}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <Download size={14} />
                              <span>Экспорт</span>
                            </Link>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
                              onClick={() => {
                                setSaveAsId(dashboard.id);
                                setSaveAsName(`${dashboard.name} (копия)`);
                                setOpenMenuId(null);
                              }}
                            >
                              <Copy size={14} />
                              <span>Копировать</span>
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                              onClick={() => {
                                setDeleteId(dashboard.id);
                                setOpenMenuId(null);
                              }}
                            >
                              <Trash2 size={14} />
                              <span>Удалить</span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isCreateOpen ? (
        <ConstructorNameModal
          title="Новый дашборд"
          submitLabel="Создать"
          value={createName}
          onChange={setCreateName}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}

      {saveAsId ? (
        <ConstructorNameModal
          title="Копировать"
          submitLabel="Сохранить"
          value={saveAsName}
          onChange={setSaveAsName}
          onClose={() => setSaveAsId(null)}
          onSubmit={handleSaveAs}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Удалить дашборд?"
          message={`«${deleteTarget.name}» будет удалён из истории. Это действие нельзя отменить.`}
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          onConfirm={() => {
            deleteDashboard(deleteTarget.id);
            setDeleteId(null);
          }}
          onCancel={() => setDeleteId(null)}
        />
      ) : null}
    </div>
  );
}
