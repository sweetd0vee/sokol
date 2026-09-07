import type { DvaCheckLifecycleRow } from '../api/analytics';
import { parseDateValue } from './dates';
import { pluralRu } from './pluralRu';

export const DVA_AUDITOR_BAR_LIMIT = 12;

const DAY_MS = 86_400_000;
const LIFECYCLE_RANGE_PAD_RATIO = 0.04;
const LIFECYCLE_MIN_TICK_GAP_RATIO = 0.08;

export const CHECK_LIFECYCLE_MILESTONES = [
  { key: 'order', dateKey: 'orderDate', label: 'Приказ' },
  { key: 'program', dateKey: 'programDate', label: 'Программа' },
  { key: 'az', dateKey: 'azDate', label: 'АЗ' },
  { key: 'dz', dateKey: 'dzDate', label: 'ДЗ' },
] as const;

export const CHECK_LIFECYCLE_SEGMENTS = [
  { key: 'order_to_program', from: 'order', to: 'program', label: 'Приказ → программа' },
  { key: 'program_to_az', from: 'program', to: 'az', label: 'Программа → АЗ' },
  { key: 'az_to_dz', from: 'az', to: 'dz', label: 'АЗ → ДЗ' },
] as const;

export type CheckLifecycleMilestoneKey = (typeof CHECK_LIFECYCLE_MILESTONES)[number]['key'];

export type CheckLifecyclePoint = {
  key: CheckLifecycleMilestoneKey;
  label: string;
  date: string;
  ms: number;
  percent: number;
};

export type CheckLifecycleSegment = {
  key: string;
  label: string;
  startLabel: string;
  endLabel: string;
  startDate: string;
  endDate: string;
  days: number;
  leftPercent: number;
  widthPercent: number;
};

export type CheckLifecycleViewRow = {
  id: string;
  key: string;
  shortName: string;
  auditor: string;
  points: CheckLifecyclePoint[];
  segments: CheckLifecycleSegment[];
  totalDays: number | null;
};

export type CheckLifecycleTick = {
  ms: number;
  label: string;
  percent: number;
};

export type CheckLifecycleChartModel = {
  rows: CheckLifecycleViewRow[];
  rangeStart: number;
  rangeEnd: number;
  ticks: CheckLifecycleTick[];
};

export function calendarDaysBetween(startMs: number, endMs: number): number {
  return Math.round(Math.abs(endMs - startMs) / DAY_MS);
}

export function formatDurationDays(days: number): string {
  if (days === 0) {
    return 'в тот же день';
  }
  return `${days} ${pluralRu(days, 'день', 'дня', 'дней')}`;
}

export function formatLifecycleChecksCount(count: number): string {
  return `${count} ${pluralRu(count, 'проверка', 'проверки', 'проверок')}`;
}

function toPercent(ms: number, start: number, end: number): number {
  if (end <= start) {
    return 0;
  }
  return ((ms - start) / (end - start)) * 100;
}

function formatTickLabel(ms: number, spanMs: number): string {
  const date = new Date(ms);
  if (spanMs <= 45 * DAY_MS) {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
}

export function buildLifecycleAxisTicks(rangeStart: number, rangeEnd: number): CheckLifecycleTick[] {
  if (rangeEnd <= rangeStart) {
    return [];
  }
  const span = rangeEnd - rangeStart;
  const raw: number[] = [rangeStart];
  if (span <= 45 * DAY_MS) {
    const cursor = new Date(rangeStart);
    cursor.setDate(cursor.getDate() + 7);
    while (cursor.getTime() < rangeEnd - DAY_MS) {
      raw.push(cursor.getTime());
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const start = new Date(rangeStart);
    let cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    while (cursor.getTime() < rangeEnd - 2 * DAY_MS) {
      raw.push(cursor.getTime());
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  raw.push(rangeEnd);

  const minGap = span * LIFECYCLE_MIN_TICK_GAP_RATIO;
  const filtered: number[] = [];
  for (const ms of raw) {
    const previous = filtered[filtered.length - 1];
    if (previous !== undefined && ms - previous < minGap) {
      continue;
    }
    filtered.push(ms);
  }
  const last = filtered[filtered.length - 1];
  if (last !== rangeEnd) {
    if (last !== undefined && rangeEnd - last < minGap && filtered.length > 1) {
      filtered[filtered.length - 1] = rangeEnd;
    } else {
      filtered.push(rangeEnd);
    }
  }

  return filtered.map((ms) => ({
    ms,
    label: formatTickLabel(ms, span),
    percent: toPercent(ms, rangeStart, rangeEnd),
  }));
}

function paddedRange(values: number[]): { start: number; end: number } | null {
  if (values.length === 0) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return { start: min - 7 * DAY_MS, end: max + 7 * DAY_MS };
  }
  const pad = Math.max((max - min) * LIFECYCLE_RANGE_PAD_RATIO, DAY_MS);
  return { start: min - pad, end: max + pad };
}

export function buildCheckLifecycleChartModel(rows: DvaCheckLifecycleRow[]): CheckLifecycleChartModel {
  const allMs = rows.flatMap((row) =>
    CHECK_LIFECYCLE_MILESTONES
      .map((milestone) => parseDateValue(row[milestone.dateKey] ?? undefined))
      .filter((value): value is number => value !== null),
  );
  const range = paddedRange(allMs);
  const rangeStart = range?.start ?? 0;
  const rangeEnd = range?.end ?? 0;

  const viewRows = rows.map((row) => {
    const points: CheckLifecyclePoint[] = [];
    for (const milestone of CHECK_LIFECYCLE_MILESTONES) {
      const raw = row[milestone.dateKey];
      const ms = parseDateValue(raw ?? undefined);
      if (ms === null || !raw) {
        continue;
      }
      points.push({
        key: milestone.key,
        label: milestone.label,
        date: raw,
        ms,
        percent: range ? toPercent(ms, rangeStart, rangeEnd) : 0,
      });
    }

    const byKey = new Map(points.map((point) => [point.key, point]));
    const segments: CheckLifecycleSegment[] = [];
    for (const stage of CHECK_LIFECYCLE_SEGMENTS) {
      const from = byKey.get(stage.from);
      const to = byKey.get(stage.to);
      if (!from || !to) {
        continue;
      }
      const left = Math.min(from.percent, to.percent);
      const right = Math.max(from.percent, to.percent);
      segments.push({
        key: stage.key,
        label: stage.label,
        startLabel: from.label,
        endLabel: to.label,
        startDate: from.date,
        endDate: to.date,
        days: calendarDaysBetween(from.ms, to.ms),
        leftPercent: left,
        widthPercent: Math.max(right - left, 0),
      });
    }

    const totalDays =
      points.length >= 2
        ? calendarDaysBetween(points[0]!.ms, points[points.length - 1]!.ms)
        : null;

    return {
      id: row.id,
      key: row.key,
      shortName: row.shortName,
      auditor: row.auditor,
      points,
      segments,
      totalDays,
    };
  });

  return {
    rows: viewRows,
    rangeStart,
    rangeEnd,
    ticks: range ? buildLifecycleAxisTicks(rangeStart, rangeEnd) : [],
  };
}

export function unresolvedSharePercent(unresolved: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((unresolved / total) * 1000) / 10;
}

export function formatUnresolvedShare(unresolved: number, total: number): string {
  return `${String(unresolvedSharePercent(unresolved, total)).replace('.', ',')}%`;
}

export function formatUnresolvedBarLabel(unresolved: number, total: number): string {
  return `${unresolved} · ${formatUnresolvedShare(unresolved, total)}`;
}

export function formatUnresolvedCheckLine(item: {
  key: string;
  short_name?: string;
  count?: number;
}): string {
  const title = item.short_name ? `${item.key} — ${item.short_name}` : item.key;
  const count = item.count ?? 0;
  return count > 0 ? `${title} (${count})` : title;
}

export function rankAuditorRows<T extends { name: string }>(
  rows: T[],
  metric: (row: T) => number,
  options?: { limit?: number; direction?: 'asc' | 'desc'; includeZeros?: boolean },
): T[] {
  const direction = options?.direction ?? 'desc';
  const limit = options?.limit ?? DVA_AUDITOR_BAR_LIMIT;
  const includeZeros = options?.includeZeros ?? false;

  return [...rows]
    .filter((row) => includeZeros || metric(row) > 0)
    .sort((left, right) => {
      const diff =
        direction === 'desc' ? metric(right) - metric(left) : metric(left) - metric(right);
      return diff || left.name.localeCompare(right.name, 'ru');
    })
    .slice(0, limit);
}
