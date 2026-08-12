import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Trash2,
  User,
} from 'lucide-react';
import { Select } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/StateMessage';
import type { Recommendation } from '../../types/recommendation';
import {
  INDICATOR_OPTIONS,
  MATERIALITY_LEVEL_OPTIONS,
  RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
  getIndicatorLabel,
  getMaterialityDotClassName,
  getMaterialityLevelLabel,
  getRecommendationAdditionalStatusBadgeClass,
  getRecommendationAdditionalStatusLabel,
  getRecommendationStatusBadgeClass,
  getRecommendationStatusLabel,
} from '../../constants/recommendations';
import { EXPORT_FORMATS, type ExportFormat, exportRecommendationsTable } from '../../utils/exports';
import { formatRuDate, parseDateValue, toEndOfDayMs, toStartOfDayMs } from '../../utils/dates';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { useAuth } from '../../hooks/useAuth';
import { useAuditorOptions } from '../../hooks/useReferenceOptions';
import { useAuditObjectOptions } from '../../hooks/useAuditObjectOptions';
import { ConfirmDialog } from '../ui/Modal';
import { useSokolData } from '../../contexts/sokolData';
import { recommendationMatchesCurrentUser } from '../../utils/personMatch';
import { INDICATOR_ICONS } from '../recommendations/indicatorIcons';
import {
  LIST_ACTION_BUTTON_CLASS,
  LIST_ACTION_GROUP_CLASS,
  listFilterClass,
} from '../../constants/formLayout';

type SortKey =
  | 'id'
  | 'serial_number'
  | 'name'
  | 'audit_object'
  | 'deadline'
  | 'indicator'
  | 'materiality_level'
  | 'auditor'
  | 'manager'
  | 'status'
  | 'additional_status';

const getSortValue = (recommendation: Recommendation, key: SortKey) => {
  switch (key) {
    case 'id':
      return recommendation.id;
    case 'serial_number':
      return recommendation.serial_number;
    case 'name':
      return `${recommendation.name} ${recommendation.observation_name ?? ''}`;
    case 'audit_object':
      return recommendation.audit_object;
    case 'deadline':
      return parseDateValue(recommendation.deadline);
    case 'indicator':
      return (
        {
          исполнено: 0,
          'в процессе': 1,
          ожидает: 2,
          'не решено': 3,
          'не указан': 4,
        }[recommendation.indicator] ?? 999
      );
    case 'materiality_level':
      return (
        {
          высокий: 0,
          средний: 1,
          низкий: 2,
        }[recommendation.materiality_level] ?? 999
      );
    case 'auditor':
      return recommendation.auditor;
    case 'manager':
      return recommendation.manager;
    case 'status':
      return (
        {
          completed: 0,
          unresolved: 1,
          on_control: 2,
          in_progress: 3,
        }[recommendation.status] ?? 999
      );
    case 'additional_status':
      return (
        {
          on_time: 0,
          deadline_violated: 1,
          on_control: 2,
        }[recommendation.additional_status] ?? 999
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

export function RecommendationsTab() {
  const myName = useCurrentUserName();
  const [idFilter, setIdFilter] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [status, setStatus] = useState('');
  const [additionalStatus, setAdditionalStatus] = useState('');
  const [auditObject, setAuditObject] = useState('');
  const [indicator, setIndicator] = useState('');
  const [materialityLevel, setMaterialityLevel] = useState('');
  const [auditor, setAuditor] = useState('');
  const [manager, setManager] = useState('');
  const [showOnlyMe, setShowOnlyMe] = useState(false);
  const [deadlineFrom, setDeadlineFrom] = useState<Date | null>(null);
  const [deadlineTo, setDeadlineTo] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [deleteCandidate, setDeleteCandidate] = useState<Recommendation | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });
  const trimmedMyName = useMemo(() => myName.trim(), [myName]);
  const { options: auditorOptions } = useAuditorOptions(auditor);
  const { options: managerOptions } = useAuditorOptions(manager);
  const { options: auditObjectOptions } = useAuditObjectOptions(auditObject);

  const { recommendations, checks, deleteRecommendation } = useSokolData();
  const { isAdmin } = useAuth();

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((recommendation) => {
      if (idFilter && !recommendation.id.toLowerCase().includes(idFilter.trim().toLowerCase())) {
        return false;
      }
      if (keyFilter && !recommendation.serial_number.toLowerCase().includes(keyFilter.trim().toLowerCase())) {
        return false;
      }
      if (nameFilter) {
        const query = nameFilter.trim().toLowerCase();
        const searchableName = [
          recommendation.name,
          recommendation.observation_name ?? '',
        ].join(' ').toLowerCase();
        if (!searchableName.includes(query)) {
          return false;
        }
      }
      if (status && recommendation.status !== status) {
        return false;
      }
      if (additionalStatus && recommendation.additional_status !== additionalStatus) {
        return false;
      }
      if (auditObject && recommendation.audit_object !== auditObject) {
        return false;
      }
      if (indicator && recommendation.indicator !== indicator) {
        return false;
      }
      if (materialityLevel && recommendation.materiality_level !== materialityLevel) {
        return false;
      }
      if (auditor && recommendation.auditor !== auditor) {
        return false;
      }
      if (manager && recommendation.manager !== manager) {
        return false;
      }
      if (showOnlyMe) {
        if (!trimmedMyName) {
          return false;
        }
        if (!recommendationMatchesCurrentUser(recommendation, trimmedMyName)) {
          return false;
        }
      }
      if (deadlineFrom || deadlineTo) {
        const deadlineMs = parseDateValue(recommendation.deadline);
        if (deadlineMs === null) {
          return false;
        }
        if (deadlineFrom && deadlineMs < toStartOfDayMs(deadlineFrom)) {
          return false;
        }
        if (deadlineTo && deadlineMs > toEndOfDayMs(deadlineTo)) {
          return false;
        }
      }
      return true;
    });
  }, [
    recommendations,
    idFilter,
    keyFilter,
    nameFilter,
    status,
    additionalStatus,
    auditObject,
    indicator,
    materialityLevel,
    auditor,
    manager,
    deadlineFrom,
    deadlineTo,
    showOnlyMe,
    trimmedMyName,
  ]);

  const sortedRecommendations = useMemo(() => {
    const sortKey = sortConfig.key;
    if (!sortKey) {
      return filteredRecommendations;
    }
    const sorted = [...filteredRecommendations];
    sorted.sort((a, b) => {
      const valueA = getSortValue(a, sortKey);
      const valueB = getSortValue(b, sortKey);
      const cmp = compareValues(valueA, valueB);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRecommendations, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedRecommendations.length / pageSize));
  const pagedRecommendations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRecommendations.slice(startIndex, startIndex + pageSize);
  }, [sortedRecommendations, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    idFilter,
    keyFilter,
    nameFilter,
    status,
    additionalStatus,
    auditObject,
    indicator,
    materialityLevel,
    auditor,
    manager,
    deadlineFrom,
    deadlineTo,
    pageSize,
    showOnlyMe,
    trimmedMyName,
  ]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const handleResetFilters = () => {
    setIdFilter('');
    setKeyFilter('');
    setNameFilter('');
    setStatus('');
    setAdditionalStatus('');
    setAuditObject('');
    setIndicator('');
    setMaterialityLevel('');
    setAuditor('');
    setManager('');
    setDeadlineFrom(null);
    setDeadlineTo(null);
    setShowOnlyMe(false);
  };

  const handleRequestDelete = (recommendation: Recommendation) => {
    setDeleteCandidate(recommendation);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) {
      return;
    }
    await deleteRecommendation(deleteCandidate.id);
    setDeleteCandidate(null);
  };

  const handleCancelDelete = () => {
    setDeleteCandidate(null);
  };

  const handleExport = async () => {
    if (sortedRecommendations.length === 0) {
      return;
    }
    setIsExporting(true);
    try {
      await exportRecommendationsTable(
        sortedRecommendations,
        checks,
        exportFormat,
        'recommendations',
      );
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

  const renderSortableHeader = (key: SortKey, label: ReactNode, className = '') => (
    <th className={`px-4 py-3 text-left font-medium ${className}`}>
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 text-left text-white/90 transition hover:text-white"
      >
        <span className="leading-tight">{label}</span>
        {renderSortIcon(key)}
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-sber-dark text-center sm:text-left">Рекомендации</h2>
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
            to="/recommendations/new"
            className={`${LIST_ACTION_BUTTON_CLASS} bg-[#90EE90] text-gray-700 transition hover:bg-[#7fdc7f]`}
          >
            Создать
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-base table-fixed min-w-[1800px]">
            <colgroup>
              <col className="w-16" />
              <col className="w-40" />
              <col />
              <col className="w-52" />
              <col className="w-28" />
              <col className="w-40" />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-[140px]" />
              <col className="w-40" />
              <col className="w-52" />
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
                    value={auditObject}
                    onChange={setAuditObject}
                    options={auditObjectOptions}
                    placeholder="Все"
                    inputClassName={listFilterClass(Boolean(auditObject))}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <Select
                    value={indicator}
                    onChange={setIndicator}
                    options={INDICATOR_OPTIONS}
                    placeholder="Все"
                    inputClassName={listFilterClass(Boolean(indicator))}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <div className="flex flex-col gap-1.5">
                    <DatePicker
                      selected={deadlineFrom}
                      onChange={setDeadlineFrom}
                      placeholder="с"
                      inputClassName={listFilterClass(Boolean(deadlineFrom))}
                    />
                    <DatePicker
                      selected={deadlineTo}
                      onChange={setDeadlineTo}
                      placeholder="по"
                      inputClassName={listFilterClass(Boolean(deadlineTo))}
                    />
                  </div>
                </th>
                <th className="px-2 py-2 font-normal">
                  <Select
                    value={materialityLevel}
                    onChange={setMaterialityLevel}
                    options={MATERIALITY_LEVEL_OPTIONS}
                    placeholder="Все"
                    inputClassName={listFilterClass(Boolean(materialityLevel))}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <Select
                    value={auditor}
                    onChange={setAuditor}
                    options={auditorOptions}
                    placeholder="Все"
                    inputClassName={listFilterClass(Boolean(auditor))}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <Select
                    value={manager}
                    onChange={setManager}
                    options={managerOptions}
                    placeholder="Все"
                    inputClassName={listFilterClass(Boolean(manager))}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <Select
                    value={status}
                    onChange={setStatus}
                    options={RECOMMENDATION_STATUS_OPTIONS}
                    placeholder="Все"
                    inputClassName={listFilterClass(Boolean(status))}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <Select
                    value={additionalStatus}
                    onChange={setAdditionalStatus}
                    options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS}
                    placeholder="Все"
                    inputClassName={listFilterClass(Boolean(additionalStatus))}
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
                {renderSortableHeader('id', 'ID')}
                {renderSortableHeader('serial_number', 'Ключ')}
                {renderSortableHeader('name', 'Название')}
                {renderSortableHeader(
                  'audit_object',
                  <>
                    Объект
                    <br />
                    аудита
                  </>,
                )}
                {renderSortableHeader('indicator', 'Индикатор')}
                {renderSortableHeader('deadline', 'Срок исполнения')}
                {renderSortableHeader('materiality_level', 'Уровень')}
                {renderSortableHeader('auditor', 'Аудитор')}
                {renderSortableHeader(
                  'manager',
                  <>
                    <span className="whitespace-nowrap">Руководитель</span>
                    <br />
                    <span className="whitespace-nowrap">объекта аудита</span>
                  </>,
                )}
                {renderSortableHeader('status', 'Статус')}
                {renderSortableHeader('additional_status', 'Дополнительный статус')}
                <th className="px-0 py-3 text-center font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagedRecommendations.map((recommendation) => (
                <tr key={recommendation.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{recommendation.id}</td>
                  <td className="px-4 py-3">{recommendation.serial_number}</td>
                  <td
                    className="px-4 py-3"
                    title={`Название рекомендации: ${recommendation.name}\nНазвание наблюдения: ${recommendation.observation_name ?? ''}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="truncate">{recommendation.name}</div>
                      {recommendation.observation_name ? (
                        <div className="truncate text-sm leading-snug text-gray-500">
                          {recommendation.observation_name}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 truncate" title={recommendation.audit_object}>
                    {recommendation.audit_object}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const meta = INDICATOR_ICONS[recommendation.indicator];
                      if (!meta) {
                        return <span className="text-gray-400">—</span>;
                      }
                      const Icon = meta.Icon;
                      return (
                        <span
                          className="inline-flex items-center justify-center"
                          title={getIndicatorLabel(recommendation.indicator)}
                        >
                          <Icon size={18} className={meta.className} aria-hidden />
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 pr-6">{formatRuDate(recommendation.deadline)}</td>
                  <td className="px-2 py-3 text-center">
                    <span
                      className={`inline-block h-[18px] w-[18px] rounded-full ${getMaterialityDotClassName(recommendation.materiality_level)}`}
                      title={getMaterialityLevelLabel(recommendation.materiality_level)}
                      aria-label={getMaterialityLevelLabel(recommendation.materiality_level)}
                    />
                  </td>
                  <td className="px-4 py-3 truncate" title={recommendation.auditor}>
                    {recommendation.auditor}
                  </td>
                  <td className="px-4 py-3 truncate" title={recommendation.manager}>
                    {recommendation.manager}
                  </td>
                  <td className="px-4 py-3 pr-6">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-base font-medium whitespace-nowrap ${getRecommendationStatusBadgeClass(recommendation.status)}`}
                    >
                      {getRecommendationStatusLabel(recommendation.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 pl-6">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-base font-medium whitespace-nowrap ${getRecommendationAdditionalStatusBadgeClass(recommendation.additional_status)}`}
                    >
                      {getRecommendationAdditionalStatusLabel(recommendation.additional_status)}
                    </span>
                  </td>
                  <td className="px-0 py-3">
                    <div className={LIST_ACTION_GROUP_CLASS}>
                      <Link
                        to={`/recommendations/${recommendation.id}/edit`}
                        state={{ recommendation }}
                        className={`${LIST_ACTION_BUTTON_CLASS} border border-[#003366] text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`}
                      >
                        <PencilLine size={14} />
                        Редактировать
                      </Link>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRequestDelete(recommendation)}
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
          {filteredRecommendations.length === 0 && (
              <div className="border-t border-gray-200 p-6">
              <EmptyState
                title="Рекомендации не найдены"
                description="Измените фильтры или создайте новую рекомендацию."
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || sortedRecommendations.length === 0}
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
              Отработка фильтра: {filteredRecommendations.length} записей
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="whitespace-nowrap text-sm text-gray-600">
              {sortedRecommendations.length > 0
                ?`Показано ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedRecommendations.length)} из ${sortedRecommendations.length}`
                : 'Показано 0 из 0'}
            </span>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Строк на странице:</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20"
              >
                {[10, 15, 20, 50, 100].map((size) => (
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
      </div>

      {deleteCandidate && (
        <ConfirmDialog
          title="Удаление рекомендации"
          message={`Вы действительно хотите удалить рекомендацию «${deleteCandidate.name}»?`}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
}
