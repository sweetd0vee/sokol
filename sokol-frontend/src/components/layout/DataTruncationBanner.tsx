import { useSokolData } from '../../contexts/sokolData';

/** Warn when client bulk-fetch hit the list cap and server has more rows. */
export function DataTruncationBanner() {
  const {
    checksTruncated,
    recommendationsTruncated,
    checksTotal,
    recommendationsTotal,
    checks,
    recommendations,
    listFetchLimit,
  } = useSokolData();

  if (!checksTruncated && !recommendationsTruncated) {
    return null;
  }

  const parts: string[] = [];
  if (checksTruncated) {
    parts.push(`проверок загружено ${checks.length} из ${checksTotal}`);
  }
  if (recommendationsTruncated) {
    parts.push(`рекомендаций загружено ${recommendations.length} из ${recommendationsTotal}`);
  }

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      В интерфейсе виден не полный набор данных ({parts.join('; ')}). Лимит загрузки —{' '}
      {listFetchLimit}. Списки, «Мои» и экспорт таблиц работают только по загруженному срезу;
      серверная аналитика считает по всей БД.
    </div>
  );
}
