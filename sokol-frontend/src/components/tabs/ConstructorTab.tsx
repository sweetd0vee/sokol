import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState } from '../ui/StateMessage';
import { ConfirmDialog } from '../ui/Modal';
import { Input } from '../ui/Input';
import {
  LIST_CHROME_RIGHT_INSET_CLASS,
  LIST_CREATE_BUTTON_CLASS,
  listFilterClass,
} from '../../constants/formLayout';
import { useAnalyticsConstructor } from '../analytics/constructor/analyticsConstructorState';
import { ConstructorNameModal } from '../analytics/constructor/ConstructorNameModal';
import { ConstructorRowActions } from '../analytics/constructor/ConstructorRowActions';
import {
  defaultDashboardName,
  type ConstructorDashboardRecord,
} from '../analytics/constructor/constructorLibrary';
import { useClientTable } from '../../hooks/useClientTable';
import { ListPagination } from '../lists/ListPagination';
import { ListColumnHeaderCell, ListSortHeader } from '../lists/ListSortHeader';
import { ListFilterCell, ListResetFiltersButton } from '../lists/ListFilterCell';
import { ListEmptyNotice, ListFilterCount, ListTableFooter, ListTableShell } from '../lists/ListTableShell';
import {
  dashboardSourceKinds,
  dashboardSourceSummary,
  defaultConstructorDashboards,
  filterConstructorDashboards,
  getConstructorSortValue,
  type ConstructorSortKey,
} from '../../utils/constructorList';

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString('ru-RU');
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
  const [nameFilter, setNameFilter] = useState('');

  const filteredDashboards = useMemo(
    () => filterConstructorDashboards(defaultConstructorDashboards(dashboards), nameFilter),
    [dashboards, nameFilter],
  );
  const getSortValue = useCallback(
    (dashboard: ConstructorDashboardRecord, key: ConstructorSortKey) =>
      getConstructorSortValue(dashboard, key),
    [],
  );
  const {
    sortConfig,
    toggleSort,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    pagedItems: pagedDashboards,
    rangeLabel,
  } = useClientTable({
    items: filteredDashboards,
    getSortValue,
    resetKey: nameFilter,
  });
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

  const handleResetFilters = () => {
    setNameFilter('');
  };

  return (
    <div className="w-full space-y-5 text-left">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Конструктор дашбордов" />
        <div className={`mx-auto flex shrink-0 items-center sm:mx-0 ${LIST_CHROME_RIGHT_INSET_CLASS}`}>
          <button
            type="button"
            onClick={openCreate}
            className={LIST_CREATE_BUTTON_CLASS}
          >
            Создать дашборд
          </button>
        </div>
      </div>

      {dashboards.length === 0 ? (
        <EmptyState
          title="Пока нет дашбордов"
          description="Создайте лист или добавьте график из аналитики / планирования — появится черновик в этой истории."
        />
      ) : (
        <ListTableShell
          scrollClassName="overflow-visible"
          empty={
            filteredDashboards.length === 0 ? (
              <ListEmptyNotice>
                <EmptyState
                  title="Дашборды не найдены"
                  description="Измените название в фильтре или создайте новый дашборд."
                />
              </ListEmptyNotice>
            ) : null
          }
          footer={
            <ListTableFooter
              pagination={
                <ListPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  rangeLabel={rangeLabel}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              }
            >
              <ListFilterCount count={filteredDashboards.length} />
            </ListTableFooter>
          }
        >
          <table className="min-w-full table-fixed text-left text-base">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[8%]" />
              <col className="w-[18%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <ListFilterCell>
                  <Input
                    value={nameFilter}
                    onChange={setNameFilter}
                    placeholder="Название"
                    inputClassName={listFilterClass(Boolean(nameFilter.trim()))}
                  />
                </ListFilterCell>
                <ListFilterCell />
                <ListFilterCell />
                <ListFilterCell />
                <ListFilterCell />
                <ListFilterCell alignEnd>
                  <div className="ml-auto flex w-[160px] items-center justify-end">
                    <ListResetFiltersButton onClick={handleResetFilters} />
                  </div>
                </ListFilterCell>
              </tr>
              <tr className="bg-[#003366] text-white">
                <ListSortHeader
                  label="Название"
                  active={sortConfig.key === 'name'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('name')}
                />
                <ListSortHeader
                  label="Графиков"
                  active={sortConfig.key === 'charts'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('charts')}
                />
                <ListSortHeader
                  label="Источники"
                  active={sortConfig.key === 'sources'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('sources')}
                />
                <ListSortHeader
                  label="Изменён"
                  active={sortConfig.key === 'updatedAt'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('updatedAt')}
                />
                <ListSortHeader
                  label="Создан"
                  active={sortConfig.key === 'createdAt'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('createdAt')}
                />
                <ListColumnHeaderCell align="center" className="pr-4">Действия</ListColumnHeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagedDashboards.map((dashboard) => {
                const kinds = dashboardSourceKinds(dashboard);
                const isActive = dashboard.id === activeDashboardId;
                return (
                  <tr key={dashboard.id} className="hover:bg-gray-50">
                    <td className="min-w-0 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
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
                    <td className="px-4 py-3 text-gray-600">{dashboardSourceSummary(kinds)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(dashboard.updatedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(dashboard.createdAt)}</td>
                    <td className="overflow-visible px-0 pr-4 py-3">
                      <ConstructorRowActions
                        dashboardId={dashboard.id}
                        dashboardName={dashboard.name}
                        isActive={isActive}
                        menuOpen={openMenuId === dashboard.id}
                        onToggleMenu={() =>
                          setOpenMenuId((current) => (current === dashboard.id ? null : dashboard.id))
                        }
                        onMakeCurrent={() => {
                          setActiveDashboard(dashboard.id);
                          setOpenMenuId(null);
                        }}
                        onCopy={() => {
                          setSaveAsId(dashboard.id);
                          setSaveAsName(`${dashboard.name} (копия)`);
                          setOpenMenuId(null);
                        }}
                        onDelete={() => {
                          setDeleteId(dashboard.id);
                          setOpenMenuId(null);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ListTableShell>
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
