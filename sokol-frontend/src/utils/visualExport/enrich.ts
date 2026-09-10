import {
  buildEffectivenessMatrixHtmlMarkup,
  type EffectivenessMatrixRow,
} from '../checkAnalytics';
import {
  buildMaterialityMatrixHtmlMarkup,
  type MaterialityMatrixRow,
} from '../materialityMatrix';
import {
  buildStatusMatrixHtmlMarkup,
  type StatusMatrixRow,
} from '../statusMatrix';
import type { DashboardChartCapture } from '../dashboardChartRegistry';

export function enrichEffectivenessMatrixCapture(
  charts: DashboardChartCapture[],
  rows: EffectivenessMatrixRow[] | undefined,
  selected: boolean,
): DashboardChartCapture[] {
  if (!selected || !rows?.length) {
    return charts;
  }

  const htmlMarkup = buildEffectivenessMatrixHtmlMarkup(rows);
  const matrixMeta = {
    id: 'effectivenessMatrix',
    title: 'Оценка эффективности',
    description: 'Матрица оценок по проверкам за период',
    width: 960,
    height: 540,
  } as const;

  const index = charts.findIndex((chart) => chart.id === 'effectivenessMatrix');
  if (index >= 0) {
    const next = [...charts];
    next[index] = {
      ...next[index],
      htmlMarkup,
      svgMarkup: undefined,
    };
    return next;
  }

  return [
    ...charts,
    {
      ...matrixMeta,
      dataUrl: '',
      htmlMarkup,
    },
  ];
}

export function enrichMaterialityMatrixCapture(
  charts: DashboardChartCapture[],
  rows: MaterialityMatrixRow[] | undefined,
  selected: boolean,
): DashboardChartCapture[] {
  if (!selected || !rows?.length) {
    return charts;
  }

  const htmlMarkup = buildMaterialityMatrixHtmlMarkup(rows);
  const matrixMeta = {
    id: 'materialityMatrix',
    title: 'Матрица существенности',
    description: '',
    width: 960,
    height: 540,
  } as const;

  const index = charts.findIndex((chart) => chart.id === 'materialityMatrix');
  if (index >= 0) {
    const next = [...charts];
    next[index] = {
      ...next[index],
      htmlMarkup,
      svgMarkup: undefined,
    };
    return next;
  }

  return [
    ...charts,
    {
      ...matrixMeta,
      dataUrl: '',
      htmlMarkup,
    },
  ];
}

export function enrichStatusMatrixCapture(
  charts: DashboardChartCapture[],
  rows: StatusMatrixRow[] | undefined,
  selected: boolean,
): DashboardChartCapture[] {
  if (!selected || !rows?.length) {
    return charts;
  }

  const htmlMarkup = buildStatusMatrixHtmlMarkup(rows);
  const matrixMeta = {
    id: 'statusMatrix',
    title: 'Матрица статусов',
    description: 'Матрица статусов по проверкам за период',
    width: 960,
    height: 540,
  } as const;

  const index = charts.findIndex((chart) => chart.id === 'statusMatrix');
  if (index >= 0) {
    const next = [...charts];
    next[index] = {
      ...next[index],
      htmlMarkup,
      svgMarkup: undefined,
    };
    return next;
  }

  return [
    ...charts,
    {
      ...matrixMeta,
      dataUrl: '',
      htmlMarkup,
    },
  ];
}
