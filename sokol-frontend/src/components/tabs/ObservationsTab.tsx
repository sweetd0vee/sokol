import { useMemo, useState, type ReactNode } from 'react';
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
import type { Observation } from '../../types/observation';
import {
  MATERIALITY_LEVEL_OPTIONS,
  OBSERVATION_STATUS_OPTIONS,
  getMaterialityDotClassName,
  getMaterialityLevelLabel,
  getObservationStatusBadgeClass,
  getObservationStatusLabel,
} from '../../constants/observations';
import { formatRuDate, parseDateValue, toEndOfDayMs, toStartOfDayMs } from '../../utils/dates';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { useAuditorOptions } from '../../hooks/useReferenceOptions';
import { ConfirmDialog } from '../ui/Modal';
import { useSokolData } from '../../contexts/sokolData';
import { DEMO_OBSERVATION_SEEDS } from '../../data/demoObservations';
import type { Recommendation } from '../../types/recommendation';
import {
  LIST_ACTION_BUTTON_CLASS,
  LIST_ACTION_GROUP_CLASS,
} from '../../constants/formLayout';

type SortKey =
  | 'id'
  | 'number'
  | 'check_serial_number'
  | 'name'
  | 'chapter_title'
  | 'materiality_level'
  | 'deadline'
  | 'auditor'
  | 'status'
  | 'recommendation_count';

const RELATED_RECOMMENDATIONS_PER_OBSERVATION = 2;

const buildDemoObservations = (recommendations: Recommendation[]): Observation[] => {
  const fallbackCheckSerial = recommendations[0]?.serial_number ?? 'ПРВ-2025-001';

  return DEMO_OBSERVATION_SEEDS.map((seed, index) => {
    const relatedRecommendations = recommendations
      .filter((_, recommendationIndex) => recommendationIndex % DEMO_OBSERVATION_SEEDS.length === index)
      .slice(0, RELATED_RECOMMENDATIONS_PER_OBSERVATION);

    return {
      ...seed,
      check_serial_number: relatedRecommendations[0]?.serial_number ?? fallbackCheckSerial,
      auditor: relatedRecommendations[0]?.auditor ?? 'Иванов А.А.',
      recommendation_ids: relatedRecommendations.map((recommendation) => recommendation.id),
    };
  });
};

const getSortValue = (observation: Observation, key: SortKey) => {
  switch (key) {
    case 'id':
      return observation.id;
    case 'number':
      return observation.number;
    case 'check_serial_number':
      return observation.check_serial_number;
    case 'name':
      return observation.name;
    case 'chapter_title':
      return observation.chapter_title;
    case 'materiality_level':
      return (
        {
          высокий: 0,
          средний: 1,
          низкий: 2,
        }[observation.materiality_level] ?? 999
      );
    case 'deadline':
      return parseDateValue(observation.deadline);
    case 'auditor':
      return observation.auditor;
    case 'status':
      return (
        {
          open: 0,
          in_progress: 1,
          closed: 2,
        }[observation.status] ?? 999
      );
    case 'recommendation_count':
      return observation.recommendation_ids.length;
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

export function ObservationsTab() {
  const myName = useCurrentUserName();
  const [idFilter, setIdFilter] = useState('');
  const [numberFilter, setNumberFilter] = useState('');
  const [checkFilter, setCheckFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [materialityLevel, setMaterialityLevel] = useState('');
  const [status, setStatus] = useState('');
  const [auditor, setAuditor] = useState('');
  const [showOnlyMe, setShowOnlyMe] = useState(false);
  const [deadlineFrom, setDeadlineFrom] = useState<Date | null>(null);
  const [deadlineTo, setDeadlineTo] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [deleteCandidate, setDeleteCandidate] = useState<Observation | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });
  const normalizedMyName = useMemo(() => myName.trim().toLowerCase(), [myName]);
  const { options: auditorOptions } = useAuditorOptions(auditor);
  const { recommendations } = useSokolData();
  const observations = useMemo(() => buildDemoObservations(recommendations), [recommendations]);
  const recommendationById = useMemo(() => {
    return new Map(recommendations.map((recommendation) => [recommendation.id, recommendation]));
  }, [recommendations]);

  const filteredObservations = useMemo(() => {
    return observations.filter((observation) => {
      if (idFilter && !observation.id.toLowerCase().includes(idFilter.trim().toLowerCase())) {
        return false;
      }
      if (numberFilter && !observation.number.toLowerCase().includes(numberFilter.trim().toLowerCase())) {
        return false;
      }
      if (checkFilter && !observation.check_serial_number.toLowerCase().includes(checkFilter.trim().toLowerCase())) {
        return false;
      }
      if (
        chapterFilter
        && !`${observation.chapter} ${observation.chapter_title}`
          .toLowerCase()
          .includes(chapterFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (nameFilter && !observation.name.toLowerCase().includes(nameFilter.trim().toLowerCase())) {
        return false;
      }
      if (materialityLevel && observation.materiality_level !== materialityLevel) {
        return false;
      }
      if (status && observation.status !== status) {
        return false;
      }
      if (auditor && observation.auditor !== auditor) {
        return false;
      }
      if (showOnlyMe) {
        if (!normalizedMyName) {
          return false;
        }
        if (observation.auditor.toLowerCase() !== normalizedMyName) {
          return false;
        }
      }
      if (deadlineFrom || deadlineTo) {
        const deadlineMs = parseDateValue(observation.deadline);
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
    observations,
    idFilter,
    numberFilter,
    checkFilter,
    chapterFilter,
    nameFilter,
    materialityLevel,
    status,
    auditor,
    deadlineFrom,
    deadlineTo,
    showOnlyMe,
    normalizedMyName,
  ]);

  const sortedObservations = useMemo(() => {
    const sortKey = sortConfig.key;
    if (!sortKey) {
      return filteredObservations;
    }
    const sorted = [...filteredObservations];
    sorted.sort((a, b) => {
      const valueA = getSortValue(a, sortKey);
      const valueB = getSortValue(b, sortKey);
      const cmp = compareValues(valueA, valueB);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredObservations, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedObservations.length / pageSize));
  const effectiveCurrentPage = Math.min(currentPage, totalPages);
  const pagedObservations = useMemo(() => {
    const startIndex = (effectiveCurrentPage - 1) * pageSize;
    return sortedObservations.slice(startIndex, startIndex + pageSize);
  }, [sortedObservations, effectiveCurrentPage, pageSize]);

  const handleResetFilters = () => {
    setIdFilter('');
    setNumberFilter('');
    setCheckFilter('');
    setChapterFilter('');
    setNameFilter('');
    setMaterialityLevel('');
    setStatus('');
    setAuditor('');
    setDeadlineFrom(null);
    setDeadlineTo(null);
    setCurrentPage(1);
  };

  const handleConfirmDelete = () => {
    setDeleteCandidate(null);
  };

  const handleCancelDelete = () => {
    setDeleteCandidate(null);
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
    return sortConfig.direction === 'asc' ? (
      <ArrowUp size={14} className="text-white" />
    ) : (
      <ArrowDown size={14} className="text-white" />
    );
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

  const renderRelatedRecommendations = (observation: Observation) => {
    const relatedRecommendations = observation.recommendation_ids
      .map((id) => recommendationById.get(id))
      .filter((recommendation): recommendation is Recommendation => Boolean(recommendation));

    if (relatedRecommendations.length === 0) {
      return <span className="text-gray-400">Пока нет связей</span>;
    }

    return (
      <div className="flex flex-col gap-1">
        {relatedRecommendations.map((recommendation) => (
          <Link
            key={recommendation.id}
            to={`/recommendations/${recommendation.id}/edit`}
            state={{ recommendation }}
            className="truncate text-[#003366] underline-offset-2 transition hover:text-[#3B82F6] hover:underline dark:text-sber-light"
            title={recommendation.name}
          >
            {recommendation.serial_number}.{recommendation.sequence_number} · {recommendation.name}
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-sber-dark text-center sm:text-left dark:text-sber-light">
          Наблюдения
        </h2>
        <div className="mx-auto flex w-[334px] shrink-0 items-center justify-center gap-3.5 sm:mx-0 sm:pr-px">
          <button
            type="button"
            onClick={() => {
              setShowOnlyMe((v) => !v);
              setCurrentPage(1);
            }}
            className={`${LIST_ACTION_BUTTON_CLASS} transition-colors ${
              showOnlyMe
                ? 'bg-[#6699FF] text-white border-2 border-[#6699FF]'
                : 'bg-white text-[#6699FF] border-2 border-[#6699FF] hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white dark:bg-slate-800 dark:text-sber-light dark:border-sber-light'
            }`}
          >
            <User size={18} />
            Мои
          </button>
          <Link
            to="/observations/new"
            className={`${LIST_ACTION_BUTTON_CLASS} bg-[#90EE90] text-gray-700 transition hover:bg-[#7fdc7f] dark:text-slate-900`}
          >
            Создать
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-base table-fixed min-w-[1900px]">
              <colgroup>
                <col className="w-16" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-64" />
                <col />
                <col className="w-36" />
                <col className="w-32" />
                <col className="w-40" />
                <col className="w-36" />
                <col className="w-80" />
                <col className="w-[334px]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 dark:border-slate-700 dark:bg-slate-700/60">
                  <th className="px-2 py-2 font-normal">
                    <Input
                      value={idFilter}
                      onChange={(value) => {
                        setIdFilter(value);
                        setCurrentPage(1);
                      }}
                      placeholder="ID"
                      inputClassName="py-1.5 text-sm"
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Input
                      value={numberFilter}
                      onChange={(value) => {
                        setNumberFilter(value);
                        setCurrentPage(1);
                      }}
                      placeholder="№ наблюдения"
                      inputClassName="py-1.5 text-sm"
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Input
                      value={checkFilter}
                      onChange={(value) => {
                        setCheckFilter(value);
                        setCurrentPage(1);
                      }}
                      placeholder="Проверка"
                      inputClassName="py-1.5 text-sm"
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Input
                      value={chapterFilter}
                      onChange={(value) => {
                        setChapterFilter(value);
                        setCurrentPage(1);
                      }}
                      placeholder="Раздел АЗ"
                      inputClassName="py-1.5 text-sm"
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Input
                      value={nameFilter}
                      onChange={(value) => {
                        setNameFilter(value);
                        setCurrentPage(1);
                      }}
                      placeholder="Название наблюдения"
                      inputClassName="py-1.5 text-sm"
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Select
                      value={materialityLevel}
                      onChange={(value) => {
                        setMaterialityLevel(value);
                        setCurrentPage(1);
                      }}
                      options={MATERIALITY_LEVEL_OPTIONS}
                      placeholder="Все"
                      inputClassName="py-1.5 text-sm"
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <div className="flex flex-col gap-1.5">
                      <DatePicker
                        selected={deadlineFrom}
                        onChange={(value) => {
                          setDeadlineFrom(value);
                          setCurrentPage(1);
                        }}
                        placeholder="с"
                        inputClassName="py-1.5 text-sm"
                      />
                      <DatePicker
                        selected={deadlineTo}
                        onChange={(value) => {
                          setDeadlineTo(value);
                          setCurrentPage(1);
                        }}
                        placeholder="по"
                        inputClassName="py-1.5 text-sm"
                      />
                    </div>
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Select
                      value={auditor}
                      onChange={(value) => {
                        setAuditor(value);
                        setCurrentPage(1);
                      }}
                      options={auditorOptions}
                      placeholder="Все"
                      inputClassName="py-1.5 text-sm"
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Select
                      value={status}
                      onChange={(value) => {
                        setStatus(value);
                        setCurrentPage(1);
                      }}
                      options={OBSERVATION_STATUS_OPTIONS}
                      placeholder="Все"
                      inputClassName="py-1.5 text-sm"
                    />
                  </th>
                  <th className="px-2 py-2 font-normal" />
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
                  {renderSortableHeader('number', '№ наблюдения')}
                  {renderSortableHeader('check_serial_number', 'Проверка')}
                  {renderSortableHeader('chapter_title', 'Раздел АЗ')}
                  {renderSortableHeader('name', 'Название наблюдения')}
                  {renderSortableHeader('materiality_level', 'Уровень')}
                  {renderSortableHeader('deadline', 'Срок исполнения')}
                  {renderSortableHeader('auditor', 'Аудитор')}
                  {renderSortableHeader('status', 'Статус', 'px-2')}
                  {renderSortableHeader('recommendation_count', 'Связанные рекомендации')}
                  <th className="px-0 py-3 text-center font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {pagedObservations.map((observation) => (
                  <tr key={observation.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/70">
                    <td className="px-4 py-3">{observation.id}</td>
                    <td className="px-4 py-3 font-medium">{observation.number}</td>
                    <td className="px-4 py-3">{observation.check_serial_number}</td>
                    <td className="px-4 py-3 truncate" title={observation.chapter_title}>
                      <span className="font-medium">Раздел {observation.chapter}</span>
                      {' · '}
                      {observation.chapter_title}
                    </td>
                    <td className="px-4 py-3 truncate" title={observation.name}>
                      {observation.name}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span
                        className={`inline-block h-[18px] w-[18px] rounded-full ${getMaterialityDotClassName(observation.materiality_level)}`}
                        title={getMaterialityLevelLabel(observation.materiality_level)}
                        aria-label={getMaterialityLevelLabel(observation.materiality_level)}
                      />
                    </td>
                    <td className="px-4 py-3">{formatRuDate(observation.deadline)}</td>
                    <td className="px-4 py-3">{observation.auditor}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-base font-medium whitespace-nowrap ${getObservationStatusBadgeClass(observation.status)}`}
                      >
                        {getObservationStatusLabel(observation.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{renderRelatedRecommendations(observation)}</td>
                    <td className="px-0 py-3">
                      <div className={LIST_ACTION_GROUP_CLASS}>
                        <Link
                          to={`/observations/${observation.id}/edit`}
                          state={{ observation }}
                          className={`${LIST_ACTION_BUTTON_CLASS} border border-[#003366] text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`}
                        >
                          <PencilLine size={14} />
                          Редактировать
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(observation)}
                          className={`${LIST_ACTION_BUTTON_CLASS} border border-[#003366] text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`}
                        >
                          <Trash2 size={14} />
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredObservations.length === 0 && (
              <div className="border-t border-gray-200 p-6 dark:border-slate-700">
                <EmptyState
                  title="Наблюдения не найдены"
                  description="Измените фильтры или создайте новое наблюдение."
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-slate-300">
              <span className="whitespace-nowrap">
                Отработка фильтра: {filteredObservations.length} записей
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="whitespace-nowrap text-sm text-gray-600 dark:text-slate-300">
                {sortedObservations.length > 0
                  ? `Показано ${(effectiveCurrentPage - 1) * pageSize + 1}–${Math.min(effectiveCurrentPage * pageSize, sortedObservations.length)} из ${sortedObservations.length}`
                  : 'Показано 0 из 0'}
              </span>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                <span>Строк на странице:</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sber-light dark:focus:ring-sber-light/25"
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
                  onClick={() => setCurrentPage(Math.max(1, effectiveCurrentPage - 1))}
                  disabled={effectiveCurrentPage === 1}
                  aria-label="Предыдущая страница"
                  title="Предыдущая страница"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sber-dark transition hover:bg-sber-dark/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  Страница {effectiveCurrentPage} из {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, effectiveCurrentPage + 1))}
                  disabled={effectiveCurrentPage === totalPages}
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
          title="Удаление наблюдения"
          message={`Вы действительно хотите удалить наблюдение «${deleteCandidate.number}»?`}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
}
