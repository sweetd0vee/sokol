import { FocusableDonutChart } from '../FocusableDonutChart';
import { FocusableSquareCirclesChart } from '../FocusableSquareCirclesChart';
import { FocusableTreemapChart } from '../FocusableTreemapChart';
import { EffectivenessMatrixChart } from '../EffectivenessMatrixChart';
import { MaterialityMatrixChart } from '../MaterialityMatrixChart';
import { StatusMatrixChart } from '../StatusMatrixChart';
import { AuditorDocumentsMatrixChart } from '../AuditorDocumentsMatrixChart';
import { AuditorUnresolvedBarChart } from '../AuditorUnresolvedBarChart';
import { DepartmentUnresolvedBarChart } from '../DepartmentUnresolvedBarChart';
import { DepartmentHighMaterialityBarChart } from '../DepartmentHighMaterialityBarChart';
import { CheckLifecycleChart } from '../CheckLifecycleChart';
import {
  DVA_AUDITOR_CHECKS_SCALE,
  RECOMMENDATIONS_DEPARTMENT_MAP_SCALE,
  VALUE_BLUE_SCALE,
  VALUE_EMERALD_SCALE,
  VALUE_GRAY_SCALE,
} from '../analyticsPalette';
import { distributionHasValues } from '../../../utils/analyticsDistribution';
import { EmptyChart } from '../EmptyChart';
import type { ConstructorPayload } from './constructorTypes';
import { ConstructorBarChart } from './charts/ConstructorBarChart';
import { ConstructorCheckBarsChart } from './charts/ConstructorCheckBarsChart';
import { ConstructorDocsStackedChart } from './charts/ConstructorDocsStackedChart';
import { ConstructorKpiChart } from './charts/ConstructorKpiChart';
import { ConstructorListChart } from './charts/ConstructorListChart';
import { ConstructorMaterialityCombinedChart } from './charts/ConstructorMaterialityCombinedChart';
import { ConstructorStackedChart } from './charts/ConstructorStackedChart';

export function ConstructorChartBody({ payload }: { payload: ConstructorPayload }) {
  if (payload.chart === 'kpi') {
    return <ConstructorKpiChart payload={payload} />;
  }

  if (payload.chart === 'bar') {
    return <ConstructorBarChart payload={payload} />;
  }

  if (payload.chart === 'stacked') {
    return <ConstructorStackedChart payload={payload} />;
  }

  if (payload.chart === 'list') {
    return <ConstructorListChart payload={payload} />;
  }

  if (payload.chart === 'donut') {
    if (!distributionHasValues(payload.data)) {
      return <EmptyChart message="Нет данных" />;
    }
    return (
      <FocusableDonutChart
        data={payload.data}
        palette={VALUE_BLUE_SCALE}
        colorByValue={payload.colorByValue}
        variant={payload.variant}
        labelMode={payload.labelMode ?? 'both'}
        legendPercentFirst={payload.legendPercentFirst}
        legendLayout={payload.legendLayout}
      />
    );
  }

  if (payload.chart === 'circles') {
    if (!distributionHasValues(payload.data)) {
      return <EmptyChart message="Нет данных" />;
    }
    return (
      <FocusableSquareCirclesChart
        data={payload.data}
        labelMode="both"
        legendLayout={payload.legendLayout}
      />
    );
  }

  if (payload.chart === 'treemap') {
    if (payload.data.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return (
      <FocusableTreemapChart
        data={payload.data}
        palette={
          payload.palette === 'gray'
            ? VALUE_GRAY_SCALE
            : payload.palette === 'emerald'
              ? VALUE_EMERALD_SCALE
              : payload.palette === 'indigo'
                ? DVA_AUDITOR_CHECKS_SCALE
                : payload.palette === 'blue-muted'
                  ? RECOMMENDATIONS_DEPARTMENT_MAP_SCALE
                  : VALUE_BLUE_SCALE
        }
        colorByValue
        colorByRank={payload.palette === 'emerald'}
        colorByUniqueValue={
          payload.palette === 'teal' ||
          payload.palette === 'indigo' ||
          payload.palette === 'blue-muted'
        }
      />
    );
  }

  if (payload.chart === 'effectiveness-matrix') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <EffectivenessMatrixChart rows={payload.rows} scrollBody={false} />;
  }

  if (payload.chart === 'materiality-matrix') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <MaterialityMatrixChart rows={payload.rows} scrollBody={false} />;
  }

  if (payload.chart === 'status-matrix') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <StatusMatrixChart rows={payload.rows} scrollBody={false} />;
  }

  if (payload.chart === 'auditor-documents-matrix') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <AuditorDocumentsMatrixChart rows={payload.rows} scrollBody={false} />;
  }

  if (payload.chart === 'auditor-unresolved') {
    if (payload.data.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <AuditorUnresolvedBarChart data={payload.data} />;
  }

  if (payload.chart === 'department-unresolved') {
    if (payload.data.length === 0) {
      return <EmptyChart message="Нет нерешённых рекомендаций за период" />;
    }
    return <DepartmentUnresolvedBarChart data={payload.data} />;
  }

  if (payload.chart === 'department-high-materiality') {
    if (payload.data.length === 0) {
      return <EmptyChart message="Нет красных рекомендаций за период" />;
    }
    return <DepartmentHighMaterialityBarChart data={payload.data} />;
  }

  if (payload.chart === 'check-lifecycle') {
    if (payload.rows.length === 0) {
      return <EmptyChart message="Нет данных" />;
    }
    return <CheckLifecycleChart rows={payload.rows} />;
  }

  if (payload.chart === 'materiality-combined') {
    return <ConstructorMaterialityCombinedChart payload={payload} />;
  }

  if (payload.chart === 'check-bars') {
    return <ConstructorCheckBarsChart payload={payload} />;
  }

  return <ConstructorDocsStackedChart payload={payload} />;
}
