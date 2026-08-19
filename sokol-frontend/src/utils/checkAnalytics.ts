import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';
import { parseDateValue } from './dates';
import { getRecommendationAuditObjects } from './auditObjects';
import {
  isDateInAnySelectedPeriods,
  isDateInSelectedPeriods,
  type PeriodBucket,
  type PeriodGranularity,
} from './analyticsPeriod';

export type { PeriodGranularity, PeriodBucket };

export type EffectivenessArea = 'any' | 'process' | 'svk' | 'sur' | 'svik';

export type CheckAnalyticsFilters = {
  auditors: string[];
  granularity: PeriodGranularity;
  selectedPeriods: string[];
  selectedYears?: string[];
  selectedQuarters?: string[];
  selectedMonths?: string[];
  departments?: string[];
  recommendations?: Recommendation[];
  effectivenessArea: EffectivenessArea;
  selectedEffectivenessRatings: string[];
};

const EFFECTIVENESS_UNSET_LABEL = 'не указано';

function getCheckEffectivenessValue(check: Check, area: Exclude<EffectivenessArea, 'any'>): string {
  const raw =
    area === 'process'
      ? check.process_effectiveness
      : area === 'svk'
        ? check.svk_effectiveness
        : area === 'sur'
          ? check.sur_effectiveness
          : check.svik_effectiveness;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : EFFECTIVENESS_UNSET_LABEL;
}

function getCheckEffectivenessValues(check: Check, area: EffectivenessArea): string[] {
  if (area === 'any') {
    return (['process', 'svk', 'sur', 'svik'] as const).map((key) => getCheckEffectivenessValue(check, key));
  }
  return [getCheckEffectivenessValue(check, area)];
}

export type NamedCount = {
  name: string;
  value: number;
};

export function filterChecksForAnalytics(checks: Check[], filters: CheckAnalyticsFilters): Check[] {
  const auditorSet = new Set(filters.auditors.filter(Boolean));
  const ratingSet = new Set(filters.selectedEffectivenessRatings.filter(Boolean));
  const departmentSet = new Set((filters.departments ?? []).filter(Boolean));
  const recommendationsByCheck = new Map<string, Recommendation[]>();

  if (departmentSet.size > 0 || auditorSet.size > 0) {
    (filters.recommendations ?? []).forEach((recommendation) => {
      const serial = recommendation.serial_number.trim();
      if (!serial) {return;}
      const bucket = recommendationsByCheck.get(serial) ?? [];
      bucket.push(recommendation);
      recommendationsByCheck.set(serial, bucket);
    });
  }

  return checks.filter((check) => {
    const startMs = parseDateValue(check.start_date);
    if (startMs === null) {
      return false;
    }
    if (auditorSet.size > 0) {
      const linked = recommendationsByCheck.get(check.serial_number) ?? [];
      const matchesAuditor =
        auditorSet.has(check.check_leader)
        || linked.some((item) => auditorSet.has(item.auditor) || auditorSet.has(item.manager));
      if (!matchesAuditor) {
        return false;
      }
    }
    const hasMultiPeriodFilter =
      (filters.selectedYears?.length ?? 0) > 0
      || (filters.selectedQuarters?.length ?? 0) > 0
      || (filters.selectedMonths?.length ?? 0) > 0;
    const matchesPeriod = hasMultiPeriodFilter
      ? isDateInAnySelectedPeriods(startMs, {
          years: filters.selectedYears ?? [],
          quarters: filters.selectedQuarters ?? [],
          months: filters.selectedMonths ?? [],
        })
      : isDateInSelectedPeriods(startMs, filters.granularity, filters.selectedPeriods);
    if (!matchesPeriod) {
      return false;
    }
    if (departmentSet.size > 0) {
      const linked = recommendationsByCheck.get(check.serial_number) ?? [];
      if (
        !linked.some((item) =>
          getRecommendationAuditObjects(item.audit_object).some((department) => departmentSet.has(department)),
        )
      ) {
        return false;
      }
    }
    if (ratingSet.size > 0) {
      const values = getCheckEffectivenessValues(check, filters.effectivenessArea);
      if (!values.some((value) => ratingSet.has(value))) {
        return false;
      }
    }
    return true;
  });
}

export const EFFECTIVENESS_MATRIX_COLUMNS = [
  { key: 'process', label: 'Процесс', field: 'process_effectiveness' },
  { key: 'svk', label: 'СВК', field: 'svk_effectiveness' },
  { key: 'sur', label: 'СУР', field: 'sur_effectiveness' },
  { key: 'svik', label: 'СВИК', field: 'svik_effectiveness' },
] as const;

export type EffectivenessTone = 'effective' | 'sufficient' | 'insufficient' | 'ineffective' | 'unset';

export const EFFECTIVENESS_LEGEND: Array<{ tone: EffectivenessTone; label: string; color: string }> = [
  { tone: 'effective', label: 'Эффективно', color: '#22C55E' },
  { tone: 'sufficient', label: 'Достаточно эффективно', color: '#EAB308' },
  { tone: 'insufficient', label: 'Недостаточно эффективно', color: '#EF4444' },
  { tone: 'ineffective', label: 'Неэффективно', color: '#111827' },
  { tone: 'unset', label: 'Не оценивалось', color: '#94A3B8' },
];

export type EffectivenessMatrixRow = {
  id: string;
  key: string;
  shortName: string;
  name: string;
  ratings: Record<(typeof EFFECTIVENESS_MATRIX_COLUMNS)[number]['key'], string>;
  tones: Record<(typeof EFFECTIVENESS_MATRIX_COLUMNS)[number]['key'], EffectivenessTone>;
};

function resolveEffectivenessTone(value: string | null | undefined): EffectivenessTone {
  const raw = (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw || raw === 'не указано' || raw === 'не оценивалось') {
    return 'unset';
  }
  if (raw === 'эффективно') {
    return 'effective';
  }
  if (raw === 'достаточно эффективно') {
    return 'sufficient';
  }
  if (raw === 'недостаточно эффективно') {
    return 'insufficient';
  }
  if (raw === 'неэффективно' || raw === 'не эффективно') {
    return 'ineffective';
  }
  return 'unset';
}

export function getEffectivenessToneColor(tone: EffectivenessTone): string {
  return EFFECTIVENESS_LEGEND.find((item) => item.tone === tone)?.color ?? '#94A3B8';
}

export function formatEffectivenessChecksCount(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return `${count} проверка`;
  }
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return `${count} проверки`;
  }
  return `${count} проверок`;
}

export type EffectivenessColumnKey = (typeof EFFECTIVENESS_MATRIX_COLUMNS)[number]['key'];

export type EffectivenessColumnShare = {
  tone: EffectivenessTone;
  label: string;
  color: string;
  count: number;
  percent: number;
};

function escapeEffectivenessHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const EFFECTIVENESS_EXPORT_SQUARE_SIZE_PX = 44;

function buildEffectivenessShareSquares(shares: EffectivenessColumnShare[]) {
  if (shares.length === 0) {
    return '<span style="color:#94a3b8;font-size:12px">—</span>';
  }

  const size = EFFECTIVENESS_EXPORT_SQUARE_SIZE_PX;
  const squares = shares
    .map((share) => {
      return `<li style="display:inline-flex;align-items:center;gap:2px">
        <span style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:2px;background:#fff;border:4px solid ${share.color};color:#111827;text-align:center;line-height:1.15" title="${escapeEffectivenessHtml(`${share.label}: ${share.percent}% (${share.count})`)}">
          <span style="font-size:12px;font-weight:600">${share.percent}%</span>
        </span>
      </li>`;
    })
    .join('');

  return `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;align-items:center;gap:6px">${squares}</ul>`;
}

/** Self-contained HTML for effectiveness matrix export (no Tailwind / Recharts required). */
export function buildEffectivenessMatrixHtmlMarkup(rows: EffectivenessMatrixRow[]): string {
  if (rows.length === 0) {
    return '<div class="chart-html"><p style="margin:0;color:#64748b;font-size:14px">Нет данных</p></div>';
  }

  const columnShares = Object.fromEntries(
    EFFECTIVENESS_MATRIX_COLUMNS.map((column) => [
      column.key,
      buildEffectivenessColumnShares(rows, column.key),
    ]),
  ) as Record<EffectivenessColumnKey, EffectivenessColumnShare[]>;

  const headerCells = EFFECTIVENESS_MATRIX_COLUMNS.map(
    (column) =>
      `<th style="padding:8px 4px;text-align:center;font-weight:600">${escapeEffectivenessHtml(column.label)}</th>`,
  ).join('');

  const bodyRows = rows
    .map((row) => {
      const toneCells = EFFECTIVENESS_MATRIX_COLUMNS.map((column) => {
        const color = getEffectivenessToneColor(row.tones[column.key]);
        const rating = row.ratings[column.key] || 'Не оценивалось';
        return `<td style="padding:8px 4px;text-align:center" title="${escapeEffectivenessHtml(`${column.label}: ${rating}`)}">
          <span style="display:inline-block;width:14px;height:14px;border-radius:2px;background:${color};border:1px solid rgba(0,0,0,0.1)"></span>
        </td>`;
      }).join('');

      return `<tr style="border-bottom:1px solid #f3f4f6">
        <th style="padding:6px 12px;text-align:left;font-weight:500" title="${escapeEffectivenessHtml(row.name)}">${escapeEffectivenessHtml(row.key)}</th>
        <td style="padding:6px 12px;text-align:left;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeEffectivenessHtml(row.shortName || row.name)}">${escapeEffectivenessHtml(row.shortName || '—')}</td>
        ${toneCells}
      </tr>`;
    })
    .join('');

  const footerShareCells = EFFECTIVENESS_MATRIX_COLUMNS.map(
    (column) =>
      `<td style="padding:12px 4px;text-align:center;vertical-align:top">${buildEffectivenessShareSquares(columnShares[column.key])}</td>`,
  ).join('');

  const legend = EFFECTIVENESS_LEGEND.map(
    (item) =>
      `<li style="display:inline-flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${item.color};border:1px solid rgba(0,0,0,0.1)"></span>
        <span>${escapeEffectivenessHtml(item.label)}</span>
      </li>`,
  ).join('');

  return `<div class="chart-html"><div data-export-html style="display:flex;flex-direction:column;gap:8px">
    <div style="border:1px solid #f3f4f6;border-radius:8px;overflow:hidden">
      <div style="overflow:auto">
        <table style="width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed">
          <colgroup>
            <col style="width:14%" />
            <col style="width:34%" />
            ${EFFECTIVENESS_MATRIX_COLUMNS.map(() => '<col style="width:13%" />').join('')}
          </colgroup>
          <thead>
            <tr style="border-bottom:1px solid #f3f4f6;background:#fff">
              <th style="padding:8px 12px;text-align:left;font-weight:600">Ключ</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Краткое название проверки</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
          <tfoot data-effectiveness-matrix-footer>
            <tr style="border-top:1px solid #e5e7eb;background:#f9fafb">
              <th colspan="2" style="padding:12px;text-align:left;vertical-align:top;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#003366">Доля оценок</th>
              ${footerShareCells}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px 16px">
      <p data-effectiveness-matrix-total style="margin:0;font-size:12px;color:#4b5563">
        <span style="font-weight:600;color:#003366">Итого:</span> ${escapeEffectivenessHtml(formatEffectivenessChecksCount(rows.length))}
      </p>
      <ul data-effectiveness-matrix-legend style="display:flex;flex-wrap:wrap;gap:8px 12px;list-style:none;padding:0;margin:0;font-size:12px;color:#4b5563">${legend}</ul>
    </div>
  </div></div>`;
}

export function buildEffectivenessColumnShares(
  rows: EffectivenessMatrixRow[],
  columnKey: EffectivenessColumnKey,
): EffectivenessColumnShare[] {
  const counts = Object.fromEntries(
    EFFECTIVENESS_LEGEND.map((item) => [item.tone, 0]),
  ) as Record<EffectivenessTone, number>;

  rows.forEach((row) => {
    counts[row.tones[columnKey]] += 1;
  });

  const total = rows.length;
  return EFFECTIVENESS_LEGEND.map((item) => {
    const count = counts[item.tone];
    return {
      tone: item.tone,
      label: item.label,
      color: item.color,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });
}

export function buildEffectivenessMatrix(checks: Check[]): EffectivenessMatrixRow[] {
  return [...checks]
    .sort((a, b) => a.serial_number.localeCompare(b.serial_number, 'ru'))
    .map((check) => {
      const ratings = {
        process: check.process_effectiveness?.trim() || '',
        svk: check.svk_effectiveness?.trim() || '',
        sur: check.sur_effectiveness?.trim() || '',
        svik: check.svik_effectiveness?.trim() || '',
      } as const;
      return {
        id: check.id,
        key: check.serial_number,
        shortName: check.short_name?.trim() || '',
        name: check.check_name,
        ratings: { ...ratings },
        tones: {
          process: resolveEffectivenessTone(ratings.process),
          svk: resolveEffectivenessTone(ratings.svk),
          sur: resolveEffectivenessTone(ratings.sur),
          svik: resolveEffectivenessTone(ratings.svik),
        },
      };
    });
}
