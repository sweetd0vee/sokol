import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilLine } from 'lucide-react';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../ui/StateMessage';
import type { Check } from '../../types/check';
import {
  CHECK_STATUS_OPTIONS,
  CHECK_TYPE_OPTIONS,
  CHECK_VIEW_OPTIONS,
  getCheckStatusLabel,
  getCheckTypeLabel,
  getCheckViewLabel,
} from '../../constants/checks';
import { type ExportFormat, exportChecks } from '../../utils/exports';
import { exportCheckAttachments } from '../../utils/exportCheckAttachments';
import {
  ATTACHMENT_SLOT_LABELS,
  CHECK_ATTACHMENT_EXPORT_SLOTS,
  type AttachmentSlot,
} from '../../utils/checkAttachments';
import { formatRuDate } from '../../utils/dates';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { useAuditorOptions } from '../../hooks/useReferenceOptions';
import { useSokolData } from '../../contexts/sokolData';
import {
  LIST_ACTION_BUTTON_CLASS,
  LIST_ACTION_GROUP_CLASS,
  LIST_TABLE_COLUMN_HEADER_ROW_CLASS,
  listFilterClass,
} from '../../constants/formLayout';
import { buildCheckYearlyNumbers, getCheckYearlyId } from '../../utils/checkYearlyNumber';
import { filterChecks, getCheckSortValue, type CheckSortKey } from '../../utils/checkList';
import { getErrorMessage } from '../../api/errors';
import { useClientTable } from '../../hooks/useClientTable';
import { EntityListHeader } from '../lists/EntityListHeader';
import { ListExportControls } from '../lists/ListExportControls';
import { ListPagination } from '../lists/ListPagination';
import { ListColumnHeaderCell, ListSortHeader } from '../lists/ListSortHeader';

export function ChecksTab() {
  const myName = useCurrentUserName();
  const [idFilter, setIdFilter] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [checkTypes, setCheckTypes] = useState<string[]>([]);
  const [checkViews, setCheckViews] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [checkLeaders, setCheckLeaders] = useState<string[]>([]);
  const [showOnlyMe, setShowOnlyMe] = useState(false);
  const [startDateFrom, setStartDateFrom] = useState<Date | null>(null);
  const [startDateTo, setStartDateTo] = useState<Date | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [attachmentExportGroups, setAttachmentExportGroups] = useState<string[]>([
    ...CHECK_ATTACHMENT_EXPORT_SLOTS,
  ]);
  const [isExportingAttachments, setIsExportingAttachments] = useState(false);
  const normalizedMyName = useMemo(() => myName.trim().toLowerCase(), [myName]);
  const { options: leaderOptions } = useAuditorOptions();

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
    resetKey: [
      idFilter,
      keyFilter,
      nameFilter,
      checkTypes.join('\u0000'),
      checkViews.join('\u0000'),
      statuses.join('\u0000'),
      checkLeaders.join('\u0000'),
      startDateFrom?.getTime() ?? '',
      startDateTo?.getTime() ?? '',
      showOnlyMe,
      normalizedMyName,
    ].join('\u0001'),
  });

  const handleResetFilters = () => {
    setIdFilter('');
    setKeyFilter('');
    setNameFilter('');
    setCheckTypes([]);
    setCheckViews([]);
    setStatuses([]);
    setCheckLeaders([]);
    setStartDateFrom(null);
    setStartDateTo(null);
    setShowOnlyMe(false);
  };

  const handleExport = async () => {
    if (sortedChecks.length === 0) {
      return;
    }
    setIsExporting(true);
    try {
      await exportChecks(sortedChecks, exportFormat, 'checks', checks);
    } finally {
      setIsExporting(false);
    }
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

  if (isChecksLoading) {
    return <LoadingState title="Загрузка проверок..." />;
  }

  if (isChecksError) {
    return (
      <ErrorState
        title="Не удалось загрузить проверки"
        description={getErrorMessage(checksError, 'Проверьте подключение к API и повторите попытку.')}
        action={{ label: 'Повторить', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <EntityListHeader
        title="Проверки"
        createTo="/checks/new"
        showOnlyMe={showOnlyMe}
        onToggleOnlyMe={() => setShowOnlyMe((value) => !value)}
      />

      <div className="rounded-xl border border-gray-200 bg-white">
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-base table-fixed min-w-[1616px]">
              <colgroup>
                <col className="w-24" />
                <col className="w-40" />
                <col />
                <col className="w-32" />
                <col className="w-36" />
                <col className="w-32" />
                <col className="w-40" />
                <col className="w-[160px]" />
                <col className="w-[190px]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2 font-normal">
                    <Input
                      value={idFilter}
                      onChange={setIdFilter}
                      placeholder="ID"
                      inputClassName={listFilterClass(Boolean(idFilter.trim()))}
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Input
                      value={keyFilter}
                      onChange={setKeyFilter}
                      placeholder="Ключ"
                      inputClassName={listFilterClass(Boolean(keyFilter.trim()))}
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Input
                      value={nameFilter}
                      onChange={setNameFilter}
                      placeholder="Название"
                      inputClassName={listFilterClass(Boolean(nameFilter.trim()))}
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <MultiCheckboxSelect
                      value={checkTypes}
                      onChange={setCheckTypes}
                      options={CHECK_TYPE_OPTIONS}
                      placeholder="Все"
                      inputClassName={listFilterClass(checkTypes.length > 0)}
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <MultiCheckboxSelect
                      value={checkViews}
                      onChange={setCheckViews}
                      options={CHECK_VIEW_OPTIONS}
                      placeholder="Все"
                      inputClassName={listFilterClass(checkViews.length > 0)}
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <div className="flex flex-col gap-1.5">
                      <DatePicker
                        selected={startDateFrom}
                        onChange={setStartDateFrom}
                        placeholder="с"
                        inputClassName={listFilterClass(Boolean(startDateFrom))}
                      />
                      <DatePicker
                        selected={startDateTo}
                        onChange={setStartDateTo}
                        placeholder="по"
                        inputClassName={listFilterClass(Boolean(startDateTo))}
                      />
                    </div>
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <MultiCheckboxSelect
                      value={checkLeaders}
                      onChange={setCheckLeaders}
                      options={leaderOptions}
                      placeholder="Все"
                      inputClassName={listFilterClass(checkLeaders.length > 0)}
                    />
                  </th>
                  <th colSpan={2} className="px-0 pr-4 py-2 font-normal">
                    <div className={LIST_ACTION_GROUP_CLASS}>
                      <MultiCheckboxSelect
                        value={statuses}
                        onChange={setStatuses}
                        options={CHECK_STATUS_OPTIONS}
                        placeholder="Все"
                        className="w-[160px]"
                        inputClassName={listFilterClass(statuses.length > 0)}
                      />
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex h-[38px] w-[160px] items-center justify-center rounded-lg border border-[#003366] px-2 text-sm font-medium text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white"
                      >
                        Сбросить фильтры
                      </button>
                    </div>
                  </th>
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
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-base font-medium text-gray-800 whitespace-nowrap ${
                          check.status === 'completed'
                            ? 'bg-green-100'
                            : check.status === 'in_progress'
                              ? 'bg-yellow-100'
                              : check.status === 'not_started'
                                ? 'bg-gray-200'
                                : 'bg-gray-200'
                        }`}
                      >
                          {getCheckStatusLabel(check.status)}
                        </span>
                      </td>
                      <td className="px-0 pr-4 py-3">
                        <div className="ml-auto flex w-[160px] items-center justify-end whitespace-nowrap">
                          <Link
                            to={`/checks/${check.id}/edit`}
                            state={{ check }}
                            className={`${LIST_ACTION_BUTTON_CLASS} border border-[#003366] text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`}
                          >
                            <PencilLine size={14} />
                            Редактировать
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {filteredChecks.length === 0 && (
              <div className="border-t border-gray-200 p-6">
                <EmptyState title="Проверки не найдены" description="Измените фильтры или создайте новую проверку." />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
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
                    className="inline-flex w-[160px] items-center justify-center whitespace-nowrap rounded-lg bg-[#90EE90] px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] disabled:cursor-not-allowed disabled:opacity-50"
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
              <span className="whitespace-nowrap">
                Отработка фильтра: {filteredChecks.length} записей
              </span>
            </div>
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              rangeLabel={rangeLabel}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      </div>
    </div>
  );
}
