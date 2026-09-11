import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { MultiCheckboxSelect } from '../ui/MultiCheckboxSelect';
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
import { exportRecommendationsTable } from '../../utils/exports';
import { formatRuDate } from '../../utils/dates';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { toNameOptions, useAuditorOptions, useCheckKindOptions } from '../../hooks/useReferenceOptions';
import { useAuditObjectOptions } from '../../hooks/useAuditObjectOptions';
import { useSokolData } from '../../contexts/sokolData';
import { formatRecommendationAuditObjects } from '../../utils/auditObjects';
import { ADDITIONAL_INDICATOR_ICONS } from '../recommendations/indicatorIcons';
import { ListIndicatorIcon } from '../recommendations/ListIndicatorIcon';
import { RecommendationNameHoverCard } from '../recommendations/RecommendationNameHoverCard';
import {
  LIST_TABLE_COLUMN_HEADER_ROW_CLASS,
  listFilterClass,
} from '../../constants/formLayout';
import {
  buildRecommendationYearlyNumbers,
  getRecommendationYearlyId,
} from '../../utils/recommendationYearlyNumber';
import {
  buildCheckViewBySerial,
  filterRecommendations,
  getRecommendationCheckView,
  getRecommendationSortValue,
  type RecommendationSortKey,
} from '../../utils/recommendationList';
import { getErrorMessage } from '../../api/errors';
import { useClientTable } from '../../hooks/useClientTable';
import { useListExport } from '../../hooks/useListExport';
import { EntityListHeader } from '../lists/EntityListHeader';
import { ListExportControls } from '../lists/ListExportControls';
import { ListPagination } from '../lists/ListPagination';
import { ListColumnHeaderCell, ListSortHeader } from '../lists/ListSortHeader';
import { ListDateRangeFilter, ListFilterCell, ListResetFiltersButton } from '../lists/ListFilterCell';
import { ListEditActionLink } from '../lists/ListEditActionLink';
import { ListEmptyNotice, ListFilterCount, ListTableFooter, ListTableShell } from '../lists/ListTableShell';

export function RecommendationsTab() {
  const myName = useCurrentUserName();
  const [idFilter, setIdFilter] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [additionalIndicators, setAdditionalIndicators] = useState<string[]>([]);
  const [auditObjects, setAuditObjects] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<string[]>([]);
  const [checkViews, setCheckViews] = useState<string[]>([]);
  const [materialityLevels, setMaterialityLevels] = useState<string[]>([]);
  const [auditors, setAuditors] = useState<string[]>([]);
  const [managers, setManagers] = useState<string[]>([]);
  const [showOnlyMe, setShowOnlyMe] = useState(false);
  const [deadlineFrom, setDeadlineFrom] = useState<Date | null>(null);
  const [deadlineTo, setDeadlineTo] = useState<Date | null>(null);
  const { format: exportFormat, setFormat: setExportFormat, isExporting, runExport } = useListExport();
  const trimmedMyName = useMemo(() => myName.trim(), [myName]);
  const { options: auditorOptions } = useAuditorOptions();
  const { options: auditObjectOptions } = useAuditObjectOptions();
  const { options: checkViewOptions } = useCheckKindOptions();

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
  const checkViewBySerial = useMemo(() => buildCheckViewBySerial(checks), [checks]);
  const managerOptions = useMemo(
    () => toNameOptions(recommendations.map((recommendation) => recommendation.manager)),
    [recommendations],
  );

  const filteredRecommendations = useMemo(
    () =>
      filterRecommendations(
        recommendations,
        recommendationYearlyNumbers,
        {
          idFilter,
          keyFilter,
          nameFilter,
          statuses: [],
          additionalIndicators,
          auditObjects,
          indicators,
          checkViews,
          materialityLevels,
          auditors,
          managers,
          showOnlyMe,
          trimmedMyName,
          deadlineFrom,
          deadlineTo,
        },
        checkViewBySerial,
      ),
    [
      recommendations,
      recommendationYearlyNumbers,
      checkViewBySerial,
      idFilter,
      keyFilter,
      nameFilter,
      additionalIndicators,
      auditObjects,
      indicators,
      checkViews,
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
      getRecommendationSortValue(recommendation, key, recommendationYearlyNumbers, checkViewBySerial),
    [recommendationYearlyNumbers, checkViewBySerial],
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
      checkViews.join('\u0000'),
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
    setCheckViews([]);
    setMaterialityLevels([]);
    setAuditors([]);
    setManagers([]);
    setDeadlineFrom(null);
    setDeadlineTo(null);
    setShowOnlyMe(false);
  };

  const handleExport = () => {
    if (sortedRecommendations.length === 0) {
      return;
    }
    return runExport(() =>
      exportRecommendationsTable(
        sortedRecommendations,
        recommendations,
        checks,
        exportFormat,
        'recommendations',
      ),
    );
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

      <ListTableShell
        className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        scrollClassName="min-w-0 overflow-x-hidden"
        empty={
          filteredRecommendations.length === 0 ? (
            <ListEmptyNotice>
              <EmptyState
                title="Рекомендации не найдены"
                description="Измените фильтры или создайте новую рекомендацию."
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
            <ListExportControls
              onExport={() => void handleExport()}
              disabled={isExporting || sortedRecommendations.length === 0}
              isExporting={isExporting}
              format={exportFormat}
              onFormatChange={setExportFormat}
            />
            <ListFilterCount count={filteredRecommendations.length} />
          </ListTableFooter>
        }
      >
        <table className="w-full min-w-0 text-base table-fixed">
          <colgroup>
            <col className="w-24" />
            <col className="w-28" />
            <col />
            <col className="w-36" />
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-28" />
            <col className="w-36" />
            <col className="w-20" />
            <col className="w-32" />
            <col className="w-44" />
            <col className="w-[176px]" />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <ListFilterCell>
                <Input
                  value={idFilter}
                  onChange={setIdFilter}
                  placeholder="ID"
                  inputClassName={listFilterClass(Boolean(idFilter.trim()))}
                />
              </ListFilterCell>
              <ListFilterCell>
                <Input
                  value={keyFilter}
                  onChange={setKeyFilter}
                  placeholder="Ключ"
                  inputClassName={listFilterClass(Boolean(keyFilter.trim()))}
                />
              </ListFilterCell>
              <ListFilterCell>
                <Input
                  value={nameFilter}
                  onChange={setNameFilter}
                  placeholder="Название"
                  inputClassName={listFilterClass(Boolean(nameFilter.trim()))}
                />
              </ListFilterCell>
              <ListFilterCell>
                <MultiCheckboxSelect
                  value={auditObjects}
                  onChange={setAuditObjects}
                  options={auditObjectOptions}
                  placeholder="Все"
                  inputClassName={listFilterClass(auditObjects.length > 0)}
                />
              </ListFilterCell>
              <ListFilterCell>
                <MultiCheckboxSelect
                  value={indicators}
                  onChange={setIndicators}
                  options={INDICATOR_OPTIONS}
                  placeholder="Все"
                  inputClassName={listFilterClass(indicators.length > 0)}
                />
              </ListFilterCell>
              <ListFilterCell>
                <MultiCheckboxSelect
                  value={additionalIndicators}
                  onChange={setAdditionalIndicators}
                  options={ADDITIONAL_INDICATOR_OPTIONS}
                  placeholder="Все"
                  inputClassName={listFilterClass(additionalIndicators.length > 0)}
                />
              </ListFilterCell>
              <ListFilterCell>
                <MultiCheckboxSelect
                  value={checkViews}
                  onChange={setCheckViews}
                  options={checkViewOptions}
                  placeholder="Все"
                  inputClassName={listFilterClass(checkViews.length > 0)}
                />
              </ListFilterCell>
              <ListFilterCell>
                <ListDateRangeFilter
                  from={deadlineFrom}
                  to={deadlineTo}
                  onFromChange={setDeadlineFrom}
                  onToChange={setDeadlineTo}
                />
              </ListFilterCell>
              <ListFilterCell>
                <MultiCheckboxSelect
                  value={materialityLevels}
                  onChange={setMaterialityLevels}
                  options={MATERIALITY_LEVEL_OPTIONS}
                  placeholder="Все"
                  inputClassName={listFilterClass(materialityLevels.length > 0)}
                />
              </ListFilterCell>
              <ListFilterCell>
                <MultiCheckboxSelect
                  value={auditors}
                  onChange={setAuditors}
                  options={auditorOptions}
                  placeholder="Все"
                  inputClassName={listFilterClass(auditors.length > 0)}
                />
              </ListFilterCell>
              <ListFilterCell>
                <MultiCheckboxSelect
                  value={managers}
                  onChange={setManagers}
                  options={managerOptions}
                  placeholder="Все"
                  inputClassName={listFilterClass(managers.length > 0)}
                />
              </ListFilterCell>
              <ListFilterCell alignEnd>
                <div className="ml-auto flex w-[160px] items-center justify-end">
                  <ListResetFiltersButton onClick={handleResetFilters} />
                </div>
              </ListFilterCell>
            </tr>
            <tr className={`bg-[#003366] text-white ${LIST_TABLE_COLUMN_HEADER_ROW_CLASS}`}>
              {renderSortableHeader('id', 'ID', 'whitespace-nowrap !px-2')}
              {renderSortableHeader('serial_number', 'Ключ', '!px-2')}
              {renderSortableHeader('name', 'Название')}
              {renderSortableHeader(
                'audit_object',
                <>
                  <span>Объект</span>
                  <br />
                  <span>аудита</span>
                </>,
                '!px-2',
              )}
              {renderSortableHeader(
                'indicator',
                <>
                  <span>Индикатор</span>
                  <br />
                  <span>статуса</span>
                </>,
                '!px-2',
              )}
              {renderSortableHeader(
                'additional_indicator',
                <>
                  <span>Индикатор</span>
                  <br />
                  <span>дополнительного</span>
                  <br />
                  <span>статуса</span>
                </>,
                '!px-2',
              )}
              {renderSortableHeader('check_view', 'Вид', '!px-2')}
              {renderSortableHeader(
                'deadline',
                <>
                  <span>Срок</span>
                  <br />
                  <span>контроля</span>
                </>,
                '!px-2',
              )}
              {renderSortableHeader('materiality_level', 'Уровень', '!px-2')}
              {renderSortableHeader('auditor', 'Аудитор')}
              {renderSortableHeader(
                'manager',
                <>
                  <span className="whitespace-nowrap">Руководитель</span>
                  <br />
                  <span className="whitespace-nowrap">объекта аудита</span>
                </>,
              )}
              <ListColumnHeaderCell align="center" className="pr-4">Действия</ListColumnHeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pagedRecommendations.map((recommendation) => {
              const additionalIndicator = resolveRecommendationAdditionalIndicator(
                recommendation.additional_status,
                recommendation.additional_indicator,
              );
              const checkView = getRecommendationCheckView(recommendation, checkViewBySerial);
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
                  <td
                    className="px-4 py-3 truncate"
                    title={checkView || undefined}
                  >
                    {checkView || '—'}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">{formatRuDate(recommendation.deadline)}</td>
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
                    <ListEditActionLink
                      to={`/recommendations/${recommendation.id}/edit`}
                      state={{ recommendation }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ListTableShell>
    </div>
  );
}
