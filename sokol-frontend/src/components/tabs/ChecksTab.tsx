import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, PencilLine, Trash2, User } from 'lucide-react';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/StateMessage';
import type { Check } from '../../types/check';
import {
  CHECK_STATUS_OPTIONS,
  CHECK_TYPE_OPTIONS,
  CHECK_VIEW_OPTIONS,
  getCheckStatusLabel,
  getCheckTypeLabel,
  getCheckViewLabel,
} from '../../constants/checks';
import { EXPORT_FORMATS, type ExportFormat, exportChecks } from '../../utils/exports';
import { formatRuDate, parseDateValue, toEndOfDayMs, toStartOfDayMs } from '../../utils/dates';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { useAuth } from '../../hooks/useAuth';
import { useAuditorOptions } from '../../hooks/useReferenceOptions';
import { ConfirmDialog } from '../ui/Modal';
import { useSokolData } from '../../contexts/sokolData';
import {
  LIST_ACTION_BUTTON_CLASS,
  LIST_ACTION_GROUP_CLASS,
  listFilterClass,
} from '../../constants/formLayout';

type SortKey =
  | 'id'
  | 'serial_number'
  | 'check_name'
  | 'check_type'
  | 'check_view'
  | 'start_date'
  | 'check_leader'
  | 'status';


const getSortValue = (check: Check, key: SortKey) => {
  switch (key) {
    case 'id':
      return check.id;
    case 'serial_number':
      return check.serial_number;
    case 'check_name':
      return check.check_name;
    case 'check_type':
      return getCheckTypeLabel(check.check_type);
    case 'check_view':
      return getCheckViewLabel(check.check_view);
    case 'start_date':
      return parseDateValue(check.start_date);
    case 'check_leader':
      return check.check_leader;
    case 'status':
      return (
        {
          not_started: 0,
          in_progress: 1,
          completed: 2,
        }[check.status] ?? 999
      );
    default:
      return '';
  }
};

const compareValues = (a: string | number | null, b: string | number | null) => {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined || a === '') {
    return 1;
  }
  if (b === null || b === undefined || b === '') {
    return -1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' });
};

export function ChecksTab() {
  const myName = useCurrentUserName();
  const [idFilter, setIdFilter] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [checkType, setCheckType] = useState('');
  const [checkView, setCheckView] = useState('');
  const [status, setStatus] = useState('');
  const [checkLeader, setCheckLeader] = useState('');
  const [showOnlyMe, setShowOnlyMe] = useState(false);
  const [startDateFrom, setStartDateFrom] = useState<Date | null>(null);
  const [startDateTo, setStartDateTo] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [deleteCandidate, setDeleteCandidate] = useState<Check | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });
  const normalizedMyName = useMemo(() => myName.trim().toLowerCase(), [myName]);
  const { options: leaderOptions } = useAuditorOptions(checkLeader);

  const { checks, deleteCheck } = useSokolData();
  const { isAdmin } = useAuth();

  const filteredChecks = useMemo(() => {
    return checks.filter((check) => {
      if (idFilter && !check.id.toLowerCase().includes(idFilter.trim().toLowerCase())) {
        return false;
      }
      if (keyFilter && !check.serial_number.toLowerCase().includes(keyFilter.trim().toLowerCase())) {
        return false;
      }
      if (nameFilter && !check.check_name.toLowerCase().includes(nameFilter.trim().toLowerCase())) {
        return false;
      }
      if (checkType && check.check_type !== checkType) {
        return false;
      }
      if (checkView && check.check_view !== checkView) {
        return false;
      }
      if (status && check.status !== status) {
        return false;
      }
      if (checkLeader && check.check_leader !== checkLeader) {
        return false;
      }
      if (showOnlyMe) {
        if (!normalizedMyName) {
          return false;
        }
        if (check.check_leader.toLowerCase() !== normalizedMyName) {
          return false;
        }
      }
      if (startDateFrom || startDateTo) {
        const checkStartMs = parseDateValue(check.start_date);
        if (checkStartMs === null) {
          return false;
        }
        if (startDateFrom && checkStartMs < toStartOfDayMs(startDateFrom)) {
          return false;
        }
        if (startDateTo && checkStartMs > toEndOfDayMs(startDateTo)) {
          return false;
        }
      }
      return true;
    });
  }, [
    checks,
    idFilter,
    keyFilter,
    nameFilter,
    checkType,
    checkView,
    status,
    checkLeader,
    startDateFrom,
    startDateTo,
    showOnlyMe,
    normalizedMyName,
  ]);

  const sortedChecks = useMemo(() => {
    const sortKey = sortConfig.key;
    if (!sortKey) {
      return filteredChecks;
    }
    const sorted = [...filteredChecks];
    sorted.sort((a, b) => {
      const valueA = getSortValue(a, sortKey);
      const valueB = getSortValue(b, sortKey);
      const cmp = compareValues(valueA, valueB);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredChecks, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedChecks.length / pageSize));
  const pagedChecks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedChecks.slice(startIndex, startIndex + pageSize);
  }, [sortedChecks, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    idFilter,
    keyFilter,
    nameFilter,
    checkType,
    checkView,
    status,
    checkLeader,
    startDateFrom,
    startDateTo,
    pageSize,
    showOnlyMe,
    normalizedMyName,
  ]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const handleResetFilters = () => {
    setIdFilter('');
    setKeyFilter('');
    setNameFilter('');
    setCheckType('');
    setCheckView('');
    setStatus('');
    setCheckLeader('');
    setStartDateFrom(null);
    setStartDateTo(null);
    setShowOnlyMe(false);
  };

  const handleRequestDelete = (check: Check) => {
    setDeleteCandidate(check);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) {
      return;
    }
    await deleteCheck(deleteCandidate.id);
    setDeleteCandidate(null);
  };

  const handleCancelDelete = () => {
    setDeleteCandidate(null);
  };

  const handleExport = async () => {
    if (sortedChecks.length === 0) {
      return;
    }
    setIsExporting(true);
    try {
      await exportChecks(sortedChecks, exportFormat, 'checks');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key: null, direction: 'asc' };
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown size={14} className="text-white/60" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="text-white" />
      : <ArrowDown size={14} className="text-white" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-sber-dark text-center sm:text-left">Проверки</h2>
        <div className="mx-auto flex w-[334px] shrink-0 items-center justify-center gap-3.5 sm:mx-0 sm:pr-px">
          <button
            type="button"
            onClick={() => setShowOnlyMe((v) => !v)}
            className={`${LIST_ACTION_BUTTON_CLASS} transition-colors ${
              showOnlyMe
                ? 'bg-[#6699FF] text-white border-2 border-[#6699FF]'
                : 'bg-white text-[#6699FF] border-2 border-[#6699FF] hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white '
            }`}
          >
            <User size={18} />
            Мои
          </button>
          <Link
            to="/checks/new"
            className={`${LIST_ACTION_BUTTON_CLASS} bg-[#90EE90] text-gray-700 transition hover:bg-[#7fdc7f]`}
          >
            Создать
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-base table-fixed min-w-[1600px]">
              <colgroup>
                <col className="w-16" />
                <col className="w-40" />
                <col />
                <col className="w-32" />
                <col className="w-36" />
                <col className="w-32" />
                <col className="w-40" />
                <col className="w-40" />
                <col className="w-[334px]" />
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
                    <Select
                      value={checkType}
                      onChange={setCheckType}
                      options={CHECK_TYPE_OPTIONS}
                      placeholder="Все"
                      inputClassName={listFilterClass(Boolean(checkType))}
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Select
                      value={checkView}
                      onChange={setCheckView}
                      options={CHECK_VIEW_OPTIONS}
                      placeholder="Все"
                      inputClassName={listFilterClass(Boolean(checkView))}
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
                    <Select
                      value={checkLeader}
                      onChange={setCheckLeader}
                      options={leaderOptions}
                      placeholder="Все"
                      inputClassName={listFilterClass(Boolean(checkLeader))}
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Select
                      value={status}
                      onChange={setStatus}
                      options={CHECK_STATUS_OPTIONS}
                      placeholder="Все"
                      inputClassName={listFilterClass(Boolean(status))}
                    />
                  </th>
                  <th className="px-0 py-2 font-normal">
                    <div className={LIST_ACTION_GROUP_CLASS}>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex h-[38px] w-full items-center justify-center rounded-lg border border-[#003366] px-2 text-sm font-medium text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white"
                      >
                        Сбросить фильтры
                      </button>
                    </div>
                  </th>
                </tr>
                <tr className="bg-[#003366] text-white">
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort('id')}
                      className="inline-flex items-center gap-1 text-white/90 transition hover:text-white"
                    >
                      ID
                      {renderSortIcon('id')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort('serial_number')}
                      className="inline-flex items-center gap-1 text-white/90 transition hover:text-white"
                    >
                      Ключ
                      {renderSortIcon('serial_number')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort('check_name')}
                      className="inline-flex items-center gap-1 text-white/90 transition hover:text-white"
                    >
                      Название
                      {renderSortIcon('check_name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort('check_type')}
                      className="inline-flex items-center gap-1 text-white/90 transition hover:text-white"
                    >
                      Тип
                      {renderSortIcon('check_type')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort('check_view')}
                      className="inline-flex items-center gap-1 text-white/90 transition hover:text-white"
                    >
                      Вид
                      {renderSortIcon('check_view')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort('start_date')}
                      className="inline-flex items-center gap-1 text-white/90 transition hover:text-white"
                    >
                      Дата начала
                      {renderSortIcon('start_date')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort('check_leader')}
                      className="inline-flex items-center gap-1 text-white/90 transition hover:text-white"
                    >
                      Руководитель проверки
                      {renderSortIcon('check_leader')}
                    </button>
                  </th>
                  <th className="px-2 py-3 text-left font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort('status')}
                      className="inline-flex items-center gap-1 text-white/90 transition hover:text-white"
                    >
                      Статус
                      {renderSortIcon('status')}
                    </button>
                  </th>
                  <th className="px-0 py-3 text-center font-medium">Действия</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-gray-200">
                  {pagedChecks.map((check) => (
                    <tr key={check.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{check.id}</td>
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
                      <td className="px-0 py-3">
                        <div className={LIST_ACTION_GROUP_CLASS}>
                          <Link
                            to={`/checks/${check.id}/edit`}
                            state={{ check }}
                            className={`${LIST_ACTION_BUTTON_CLASS} border border-[#003366] text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`}
                          >
                            <PencilLine size={14} />
                            Редактировать
                          </Link>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleRequestDelete(check)}
                              className={`${LIST_ACTION_BUTTON_CLASS} border border-[#003366] text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`}
                            >
                              <Trash2 size={14} />
                              Удалить
                            </button>
                          )}
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting || sortedChecks.length === 0}
                  className="inline-flex w-[160px] items-center justify-center whitespace-nowrap rounded-lg bg-[#90EE90] px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExporting ? 'Экспорт...' : 'Экспорт'}
                </button>
                <select
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20"
                >
                  {EXPORT_FORMATS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="whitespace-nowrap">
                Отработка фильтра: {filteredChecks.length} записей
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="whitespace-nowrap text-sm text-gray-600">
                {sortedChecks.length > 0
                  ?`Показано ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedChecks.length)} из ${sortedChecks.length}`
                  : 'Показано 0 из 0'}
              </span>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Строк на странице:</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20"
                >
                  {[10, 15, 20].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label="Предыдущая страница"
                  title="Предыдущая страница"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sber-dark transition hover:bg-sber-dark/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-700">
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Следующая страница"
                  title="Следующая страница"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sber-dark transition hover:bg-sber-dark/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </>
      </div>

      {deleteCandidate && (
        <ConfirmDialog
          title="Удаление проверки"
          message={`Вы действительно хотите удалить проверку «${deleteCandidate.serial_number}»?`}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
}
