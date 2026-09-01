import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PencilLine } from 'lucide-react';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../ui/StateMessage';
import type { Recommendation } from '../../types/recommendation';
import {
  ADDITIONAL_INDICATOR_OPTIONS,
  INDICATOR_OPTIONS,
  MATERIALITY_LEVEL_OPTIONS,
  getAdditionalIndicatorLabel,
  getIndicatorLabel,
  getMaterialityDotClassName,
  getMaterialityLevelLabel,
  resolveRecommendationAdditionalIndicator,
} from '../../constants/recommendations';
import { type ExportFormat, exportRecommendationsTable } from '../../utils/exports';
import { formatRuDate } from '../../utils/dates';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { toNameOptions, useAuditorOptions } from '../../hooks/useReferenceOptions';
import { useAuditObjectOptions } from '../../hooks/useAuditObjectOptions';
import { useSokolData } from '../../contexts/sokolData';
import { formatRecommendationAuditObjects } from '../../utils/auditObjects';
import {
  ADDITIONAL_INDICATOR_ICONS,
  INDICATOR_ICONS,
  indicatorIconRenderProps,
  type IndicatorIconKey,
  type IndicatorIconMeta,
} from '../recommendations/indicatorIcons';
import { RecommendationNameHoverCard } from '../recommendations/RecommendationNameHoverCard';
import {
  LIST_ACTION_BUTTON_CLASS,
  listFilterClass,
} from '../../constants/formLayout';
import {
  buildRecommendationYearlyNumbers,
  getRecommendationYearlyId,
} from '../../utils/recommendationYearlyNumber';
import {
  filterRecommendations,
  getRecommendationSortValue,
  type RecommendationSortKey,
} from '../../utils/recommendationList';
import { getErrorMessage } from '../../api/errors';
import { useClientTable } from '../../hooks/useClientTable';
import { EntityListHeader } from '../lists/EntityListHeader';
import { ListExportControls } from '../lists/ListExportControls';
import { ListPagination } from '../lists/ListPagination';
import { ListSortHeader } from '../lists/ListSortHeader';

function ListIndicatorIcon({
  value,
  label,
  icons = INDICATOR_ICONS,
}: {
  value: IndicatorIconKey | undefined;
  label: string;
  icons?: Partial<Record<IndicatorIconKey, IndicatorIconMeta>>;
}) {
  const meta = value ? icons[value] : undefined;
  if (!meta) {
    return <span className="text-gray-400">—</span>;
  }
  const Icon = meta.Icon;
  return (
    <span className="inline-flex items-center justify-center" title={label}>
      <Icon size={18} className={meta.className} aria-hidden {...indicatorIconRenderProps(meta)} />
    </span>
  );
}

export function RecommendationsTab() {
  const myName = useCurrentUserName();
  const [idFilter, setIdFilter] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [additionalIndicators, setAdditionalIndicators] = useState<string[]>([]);
  const [auditObjects, setAuditObjects] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<string[]>([]);
  const [materialityLevels, setMaterialityLevels] = useState<string[]>([]);
  const [auditors, setAuditors] = useState<string[]>([]);
  const [managers, setManagers] = useState<string[]>([]);
  const [showOnlyMe, setShowOnlyMe] = useState(false);
  const [deadlineFrom, setDeadlineFrom] = useState<Date | null>(null);
  const [deadlineTo, setDeadlineTo] = useState<Date | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const trimmedMyName = useMemo(() => myName.trim(), [myName]);
  const { options: auditorOptions } = useAuditorOptions();
  const { options: auditObjectOptions } = useAuditObjectOptions();

  const {
    recommendations,
    isRecommendationsLoading,
    isRecommendationsError,
    recommendationsError,
    checks,
    refetch,
  } = useSokolData();
  const recommendationYearlyNumbers = useMemo(
    () => buildRecommendationYearlyNumbers(recommendations),
    [recommendations],
  );
  const managerOptions = useMemo(
    () => toNameOptions(recommendations.map((recommendation) => recommendation.manager)),
    [recommendations],
  );

  const filteredRecommendations = useMemo(
    () =>
      filterRecommendations(recommendations, recommendationYearlyNumbers, {
        idFilter,
        keyFilter,
        nameFilter,
        statuses: [],
        additionalIndicators,
        auditObjects,
        indicators,
        materialityLevels,
        auditors,
        managers,
        showOnlyMe,
        trimmedMyName,
        deadlineFrom,
        deadlineTo,
      }),
    [
      recommendations,
      recommendationYearlyNumbers,
      idFilter,
      keyFilter,
      nameFilter,
      additionalIndicators,
      auditObjects,
      indicators,
      materialityLevels,
      auditors,
      managers,
      deadlineFrom,
      deadlineTo,
      showOnlyMe,
      trimmedMyName,
    ],
  );

  const getSortValue = useCallback(
    (recommendation: Recommendation, key: RecommendationSortKey) =>
      getRecommendationSortValue(recommendation, key, recommendationYearlyNumbers),
    [recommendationYearlyNumbers],
  );

  const {
    sortConfig,
    toggleSort,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    sortedItems: sortedRecommendations,
    pagedItems: pagedRecommendations,
    rangeLabel,
  } = useClientTable({
    items: filteredRecommendations,
    getSortValue,
    resetKey: [
      idFilter,
      keyFilter,
      nameFilter,
      additionalIndicators.join('\u0000'),
      auditObjects.join('\u0000'),
      indicators.join('\u0000'),
      materialityLevels.join('\u0000'),
      auditors.join('\u0000'),
      managers.join('\u0000'),
      deadlineFrom?.getTime() ?? '',
      deadlineTo?.getTime() ?? '',
      showOnlyMe,
      trimmedMyName,
    ].join('\u0001'),
  });

  const handleResetFilters = () => {
    setIdFilter('');
    setKeyFilter('');
    setNameFilter('');
    setAdditionalIndicators([]);
    setAuditObjects([]);
    setIndicators([]);
    setMaterialityLevels([]);
    setAuditors([]);
    setManagers([]);
    setDeadlineFrom(null);
    setDeadlineTo(null);
    setShowOnlyMe(false);
  };

  const handleExport = async () => {
    if (sortedRecommendations.length === 0) {
      return;
    }
    setIsExporting(true);
    try {
      await exportRecommendationsTable(
        sortedRecommendations,
        recommendations,
        checks,
        exportFormat,
        'recommendations',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const renderSortableHeader = (key: RecommendationSortKey, label: ReactNode, className = '') => (
    <ListSortHeader
      label={label}
      className={className}
      active={sortConfig.key === key}
      direction={sortConfig.direction}
      onClick={() => toggleSort(key)}
    />
  );

  if (isRecommendationsLoading) {
    return <LoadingState title="Загрузка рекомендаций..." />;
  }

  if (isRecommendationsError) {
    return (
      <ErrorState
        title="Не удалось загрузить рекомендации"
        description={getErrorMessage(recommendationsError, 'Проверьте подключение к API и повторите попытку.')}
        action={{ label: 'Повторить', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <EntityListHeader
        title="Рекомендации"
        createTo="/recommendations/new"
        showOnlyMe={showOnlyMe}
        onToggleOnlyMe={() => setShowOnlyMe((value) => !value)}
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-base table-fixed min-w-[1644px]">
            <colgroup>
              <col className="w-24" />
              <col className="w-40" />
              <col />
              <col className="w-52" />
              <col className="w-28" />
              <col className="w-44" />
              <col className="w-44" />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-[140px]" />
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
                    value={auditObjects}
                    onChange={setAuditObjects}
                    options={auditObjectOptions}
                    placeholder="Все"
                    inputClassName={listFilterClass(auditObjects.length > 0)}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <MultiCheckboxSelect
                    value={indicators}
                    onChange={setIndicators}
                    options={INDICATOR_OPTIONS}
                    placeholder="Все"
                    inputClassName={listFilterClass(indicators.length > 0)}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <MultiCheckboxSelect
                    value={additionalIndicators}
                    onChange={setAdditionalIndicators}
                    options={ADDITIONAL_INDICATOR_OPTIONS}
                    placeholder="Все"
                    inputClassName={listFilterClass(additionalIndicators.length > 0)}
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
                  <MultiCheckboxSelect
                    value={materialityLevels}
                    onChange={setMaterialityLevels}
                    options={MATERIALITY_LEVEL_OPTIONS}
                    placeholder="Все"
                    inputClassName={listFilterClass(materialityLevels.length > 0)}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <MultiCheckboxSelect
                    value={auditors}
                    onChange={setAuditors}
                    options={auditorOptions}
                    placeholder="Все"
                    inputClassName={listFilterClass(auditors.length > 0)}
                  />
                </th>
                <th className="px-2 py-2 font-normal">
                  <MultiCheckboxSelect
                    value={managers}
                    onChange={setManagers}
                    options={managerOptions}
                    placeholder="Все"
                    inputClassName={listFilterClass(managers.length > 0)}
                  />
                </th>
                <th className="px-0 pr-4 py-2 font-normal">
                  <div className="ml-auto flex w-[160px] items-center justify-end">
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
              <tr className="bg-[#003366] text-white">
                {renderSortableHeader('id', 'ID', 'whitespace-nowrap')}
                {renderSortableHeader('serial_number', 'Ключ')}
                {renderSortableHeader('name', 'Название')}
                {renderSortableHeader('audit_object', 'Объект аудита', 'whitespace-nowrap')}
                {renderSortableHeader('indicator', 'Индикатор статуса')}
                {renderSortableHeader(
                  'additional_indicator',
                  <>
                    <span className="whitespace-nowrap">Индикатор</span>
                    <br />
                    <span>дополнительного статуса</span>
                  </>,
                )}
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
                <th className="px-0 pr-4 py-3 text-center font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagedRecommendations.map((recommendation) => {
                const additionalIndicator = resolveRecommendationAdditionalIndicator(
                  recommendation.additional_status,
                  recommendation.additional_indicator,
                );
                return (
                  <tr key={recommendation.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getRecommendationYearlyId(recommendation, recommendationYearlyNumbers) ?? '—'}
                  </td>
                  <td className="px-4 py-3">{recommendation.serial_number}</td>
                  <RecommendationNameHoverCard recommendation={recommendation} />
                  <td
                    className="px-4 py-3 truncate"
                    title={formatRecommendationAuditObjects(recommendation.audit_object)}
                  >
                    {formatRecommendationAuditObjects(recommendation.audit_object)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ListIndicatorIcon
                      value={recommendation.indicator}
                      label={getIndicatorLabel(recommendation.indicator)}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ListIndicatorIcon
                      value={additionalIndicator}
                      label={getAdditionalIndicatorLabel(additionalIndicator)}
                      icons={ADDITIONAL_INDICATOR_ICONS}
                    />
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
                  <td className="px-0 pr-4 py-3">
                    <div className="ml-auto flex w-[160px] items-center justify-end whitespace-nowrap">
                      <Link
                        to={`/recommendations/${recommendation.id}/edit`}
                        state={{ recommendation }}
                        className={`${LIST_ACTION_BUTTON_CLASS} border border-[#003366] text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white`}
                      >
                        <PencilLine size={14} />
                        Редактировать
                      </Link>
                    </div>
                  </td>
                  </tr>
                );
              })}
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
            <ListExportControls
              onExport={() => void handleExport()}
              disabled={isExporting || sortedRecommendations.length === 0}
              isExporting={isExporting}
              format={exportFormat}
              onFormatChange={setExportFormat}
            />
            <span className="whitespace-nowrap">
              Отработка фильтра: {filteredRecommendations.length} записей
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
      </div>
    </div>
  );
}
