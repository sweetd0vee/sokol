import { useCallback, useMemo, useState } from 'react';
import { useCheckListFilters } from '../../hooks/usePersistedListFilters';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { EmptyState } from '../ui/StateMessage';
import type { Check } from '../../types/check';
import {
  CHECK_STATUS_OPTIONS,
  CHECK_TYPE_OPTIONS,
  getCheckTypeLabel,
  getCheckViewLabel,
} from '../../constants/checks';
import { exportChecks } from '../../utils/exports';
import { exportCheckAttachments } from '../../utils/exportCheckAttachments';
import {
  ATTACHMENT_SLOT_LABELS,
  CHECK_ATTACHMENT_EXPORT_SLOTS,
  type AttachmentSlot,
} from '../../utils/checkAttachments';
import { formatRuDate } from '../../utils/dates';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { useAuditorOptions, useCheckKindOptions } from '../../hooks/useReferenceOptions';
import { useSokolData } from '../../contexts/sokolData';
import {
  LIST_ACTION_GROUP_CLASS,
  LIST_COLUMN_FILTER_CLASS,
  LIST_EXPORT_BUTTON_CLASS,
  LIST_TABLE_COLUMN_HEADER_ROW_CLASS,
  listFilterClass,
} from '../../constants/formLayout';
import { buildCheckYearlyNumbers, getCheckYearlyId } from '../../utils/checkYearlyNumber';
import { filterChecks, getCheckSortValue, type CheckSortKey } from '../../utils/checkList';
import { buildClientTableResetKey, joinFilterValues } from '../../utils/clientTableResetKey';
import { useClientTable } from '../../hooks/useClientTable';
import { useListExport } from '../../hooks/useListExport';
import { EntityListHeader } from '../lists/EntityListHeader';
import { EntityListLoadGate } from '../lists/EntityListLoadGate';
import { ListExportControls } from '../lists/ListExportControls';
import { ListPagination } from '../lists/ListPagination';
import { ListColumnHeaderCell, ListSortHeader } from '../lists/ListSortHeader';
import {
  ListDateRangeFilter,
  ListFilterCell,
  ListResetFiltersButton,
  ListTextFilterCell,
} from '../lists/ListFilterCell';
import { ListEditActionLink } from '../lists/ListEditActionLink';
import { ListEmptyNotice, ListFilterCount, ListTableFooter, ListTableShell } from '../lists/ListTableShell';
import { CheckStatusBadge } from '../checks/CheckStatusBadge';

export function ChecksTab() {
  const myName = useCurrentUserName();
  const {
    idFilter,
    setIdFilter,
    keyFilter,
    setKeyFilter,
    nameFilter,
    setNameFilter,
    checkTypes,
    setCheckTypes,
    checkViews,
    setCheckViews,
    statuses,
    setStatuses,
    checkLeaders,
    setCheckLeaders,
    showOnlyMe,
    setShowOnlyMe,
    startDateFrom,
    setStartDateFrom,
    startDateTo,
    setStartDateTo,
    resetFilters,
  } = useCheckListFilters();
  const { format: exportFormat, setFormat: setExportFormat, isExporting, runExport } = useListExport();
  const [attachmentExportGroups, setAttachmentExportGroups] = useState<string[]>([
    ...CHECK_ATTACHMENT_EXPORT_SLOTS,
  ]);
  const [isExportingAttachments, setIsExportingAttachments] = useState(false);
  const normalizedMyName = useMemo(() => myName.trim().toLowerCase(), [myName]);
  const { options: leaderOptions } = useAuditorOptions();
  const { options: checkViewOptions } = useCheckKindOptions();

  const {
    checks,
    isChecksLoading,
    isChecksError,
    checksError,
    refetch,
  } = useSokolData();
  const yearlyNumbers = useMemo(() => buildCheckYearlyNumbers(checks), [checks]);

  const filteredChecks = useMemo(
    () =>
      filterChecks(checks, yearlyNumbers, {
        idFilter,
        keyFilter,
        nameFilter,
        checkTypes,
        checkViews,
        statuses,
        checkLeaders,
        showOnlyMe,
        normalizedMyName,
        startDateFrom,
        startDateTo,
      }),
    [
      checks,
      yearlyNumbers,
      idFilter,
      keyFilter,
      nameFilter,
      checkTypes,
      checkViews,
      statuses,
      checkLeaders,
      startDateFrom,
      startDateTo,
      showOnlyMe,
      normalizedMyName,
    ],
  );

  const getSortValue = useCallback(
    (check: Check, key: CheckSortKey) => getCheckSortValue(check, key, yearlyNumbers),
    [yearlyNumbers],
  );

  const {
    sortConfig,
    toggleSort,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    sortedItems: sortedChecks,
    pagedItems: pagedChecks,
    rangeLabel,
  } = useClientTable({
    items: filteredChecks,
    getSortValue,
    resetKey: buildClientTableResetKey([
      idFilter,
      keyFilter,
      nameFilter,
      joinFilterValues(checkTypes),
      joinFilterValues(checkViews),
      joinFilterValues(statuses),
      joinFilterValues(checkLeaders),
      startDateFrom?.getTime() ?? '',
      startDateTo?.getTime() ?? '',
      showOnlyMe,
      normalizedMyName,
    ]),
  });

  const handleResetFilters = () => {
    resetFilters();
  };

  const handleExport = () => {
    if (sortedChecks.length === 0) {
      return;
    }
    return runExport(() => exportChecks(sortedChecks, exportFormat, 'checks', checks));
  };

  const handleExportAttachments = async () => {
    if (sortedChecks.length === 0) {
      return;
    }
    if (attachmentExportGroups.length === 0) {
      window.alert('Выберите хотя бы один тип вложений для экспорта');
      return;
    }
    setIsExportingAttachments(true);
    try {
      const { filesAdded, emptyFolders } = await exportCheckAttachments(
        sortedChecks,
        attachmentExportGroups as AttachmentSlot[],
      );
      if (emptyFolders.length > 0) {
        const preview = emptyFolders
          .slice(0, 5)
          .map((entry) => `${entry.serialNumber}: ${entry.emptySlots.join(', ')}`)
          .join('\n');
        const suffix = emptyFolders.length > 5
          ? `\n... и ещё ${emptyFolders.length - 5} проверок`
          : '';
        window.alert(
          `Экспорт завершён (${filesAdded} файлов).\n`
          + `В отчёте о выборке отмечены пустые папки (${emptyFolders.length} проверок):\n`
          + `${preview}${suffix}`,
        );
      }
    } catch (error) {
      window.alert(
        `Не удалось экспортировать вложения: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`,
      );
    } finally {
      setIsExportingAttachments(false);
    }
  };

  const attachmentExportOptions = useMemo(
    () =>
      CHECK_ATTACHMENT_EXPORT_SLOTS.map((slot) => ({
        value: slot,
        label: ATTACHMENT_SLOT_LABELS[slot],
      })),
    [],
  );

  return (
    <EntityListLoadGate
      isLoading={isChecksLoading}
      isError={isChecksError}
      error={checksError}
      loadingTitle="Загрузка проверок..."
      errorTitle="Не удалось загрузить проверки"
      onRetry={() => void refetch()}
    >
      <div className="space-y-6">
        <EntityListHeader
          title="Проверки"
          createTo="/checks/new"
          showOnlyMe={showOnlyMe}
          onToggleOnlyMe={() => setShowOnlyMe((value) => !value)}
        />

        <ListTableShell
          empty={
            filteredChecks.length === 0 ? (
              <ListEmptyNotice>
                <EmptyState title="Проверки не найдены" description="Измените фильтры или создайте новую проверку." />
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
              <div className="flex flex-col gap-2">
                <ListExportControls
                  onExport={() => void handleExport()}
                  disabled={isExporting || sortedChecks.length === 0}
                  isExporting={isExporting}
                  format={exportFormat}
                  onFormatChange={setExportFormat}
                  selectClassName="w-[140px] rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExportAttachments()}
                    disabled={
                      isExportingAttachments
                      || sortedChecks.length === 0
                      || attachmentExportGroups.length === 0
                    }
                    className={LIST_EXPORT_BUTTON_CLASS}
                  >
                    {isExportingAttachments ? 'Экспорт...' : 'Экспорт файлов'}
                  </button>
                  <MultiCheckboxSelect
                    options={attachmentExportOptions}
                    value={attachmentExportGroups}
                    onChange={setAttachmentExportGroups}
                    placeholder="Типы вложений"
                    className="w-[140px]"
                    emptyMessage="Нет типов вложений"
                    menuPlacement="top"
                  />
                </div>
              </div>
              <ListFilterCount count={filteredChecks.length} />
            </ListTableFooter>
          }
        >
          <table className="w-full text-base table-fixed min-w-[1696px]">
            <colgroup>
              <col className="w-24" />
              <col className="w-40" />
              <col />
              <col className="w-40" />
              <col className="w-40" />
              <col className="w-40" />
              <col className="w-40" />
              <col className="w-[160px]" />
              <col className="w-[190px]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <ListTextFilterCell value={idFilter} onChange={setIdFilter} placeholder="ID" />
                <ListTextFilterCell value={keyFilter} onChange={setKeyFilter} placeholder="Ключ" />
                <ListTextFilterCell value={nameFilter} onChange={setNameFilter} placeholder="Название" />
                <ListFilterCell>
                  <MultiCheckboxSelect
                    value={checkTypes}
                    onChange={setCheckTypes}
                    options={CHECK_TYPE_OPTIONS}
                    placeholder="Все"
                    className={LIST_COLUMN_FILTER_CLASS}
                    inputClassName={listFilterClass(checkTypes.length > 0)}
                  />
                </ListFilterCell>
                <ListFilterCell>
                  <MultiCheckboxSelect
                    value={checkViews}
                    onChange={setCheckViews}
                    options={checkViewOptions}
                    placeholder="Все"
                    className={LIST_COLUMN_FILTER_CLASS}
                    inputClassName={listFilterClass(checkViews.length > 0)}
                  />
                </ListFilterCell>
                <ListFilterCell>
                  <ListDateRangeFilter
                    from={startDateFrom}
                    to={startDateTo}
                    onFromChange={setStartDateFrom}
                    onToChange={setStartDateTo}
                    className={LIST_COLUMN_FILTER_CLASS}
                  />
                </ListFilterCell>
                <ListFilterCell>
                  <MultiCheckboxSelect
                    value={checkLeaders}
                    onChange={setCheckLeaders}
                    options={leaderOptions}
                    placeholder="Все"
                    className={LIST_COLUMN_FILTER_CLASS}
                    inputClassName={listFilterClass(checkLeaders.length > 0)}
                  />
                </ListFilterCell>
                <ListFilterCell colSpan={2} alignEnd>
                  <div className={LIST_ACTION_GROUP_CLASS}>
                    <MultiCheckboxSelect
                      value={statuses}
                      onChange={setStatuses}
                      options={CHECK_STATUS_OPTIONS}
                      placeholder="Все"
                      className={LIST_COLUMN_FILTER_CLASS}
                      inputClassName={listFilterClass(statuses.length > 0)}
                    />
                    <ListResetFiltersButton onClick={handleResetFilters} />
                  </div>
                </ListFilterCell>
              </tr>
              <tr className={`bg-[#003366] text-white ${LIST_TABLE_COLUMN_HEADER_ROW_CLASS}`}>
                <ListSortHeader
                  label="ID"
                  className="whitespace-nowrap"
                  active={sortConfig.key === 'id'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('id')}
                />
                <ListSortHeader
                  label="Ключ"
                  active={sortConfig.key === 'serial_number'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('serial_number')}
                />
                <ListSortHeader
                  label="Название"
                  active={sortConfig.key === 'check_name'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('check_name')}
                />
                <ListSortHeader
                  label="Тип"
                  active={sortConfig.key === 'check_type'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('check_type')}
                />
                <ListSortHeader
                  label="Вид"
                  active={sortConfig.key === 'check_view'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('check_view')}
                />
                <ListSortHeader
                  label="Дата начала"
                  active={sortConfig.key === 'start_date'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('start_date')}
                />
                <ListSortHeader
                  label={
                    <>
                      <span className="whitespace-nowrap">Руководитель</span>
                      <br />
                      <span className="whitespace-nowrap">проверки</span>
                    </>
                  }
                  active={sortConfig.key === 'check_leader'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('check_leader')}
                />
                <ListSortHeader
                  label="Статус"
                  align="center"
                  active={sortConfig.key === 'status'}
                  direction={sortConfig.direction}
                  onClick={() => toggleSort('status')}
                />
                <ListColumnHeaderCell align="center" className="pr-4">Действия</ListColumnHeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagedChecks.map((check) => (
                <tr key={check.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{getCheckYearlyId(check, yearlyNumbers) ?? '—'}</td>
                  <td className="px-4 py-3">{check.serial_number}</td>
                  <td className="px-4 py-3 truncate" title={check.check_name}>
                    {check.check_name}
                  </td>
                  <td className="px-4 py-3">{getCheckTypeLabel(check.check_type)}</td>
                  <td className="px-4 py-3">{getCheckViewLabel(check.check_view)}</td>
                  <td className="px-4 py-3">{formatRuDate(check.start_date)}</td>
                  <td className="px-4 py-3">{check.check_leader}</td>
                  <td className="px-2 py-3">
                    <CheckStatusBadge status={check.status} />
                  </td>
                  <td className="px-0 pr-4 py-3">
                    <ListEditActionLink to={`/checks/${check.id}/edit`} state={{ check }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListTableShell>
      </div>
    </EntityListLoadGate>
  );
}
