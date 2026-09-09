import type {
  AuditorCheckTreemapItem,
  ChecksAnalyticsPeriodPoint,
  ChecksAnalyticsSummary,
  DeadlineExtensionByCheckRow,
  DvaAuditorDocumentRow,
  DvaAuditorExecutionRow,
  DvaAuditorMaterialityRow,
  DvaAuditorTimelinessRow,
  DvaCheckLifecycleRow,
  RecommendationPeriodPoint,
  RecommendationsSummary,
} from '../../../api/analytics';
import type { DonutDatum } from '../FocusableDonutChart';
import type { TreemapDatum } from '../FocusableTreemapChart';
import type { EffectivenessMatrixRow, NamedCount, PeriodGranularity } from '../../../utils/checkAnalytics';
import type { MaterialityMatrixRow } from '../../../utils/materialityMatrix';
import type { StatusMatrixRow } from '../../../utils/statusMatrix';

export const CONSTRUCTOR_SOURCE_LABELS = {
  checks: 'Проверки',
  recommendations: 'Рекомендации',
  monitoring: 'Мониторинг',
  dva: 'ДВА',
  planning: 'Планирование',
} as const;

export type ConstructorSourceKind = keyof typeof CONSTRUCTOR_SOURCE_LABELS;

export type ConstructorWidgetLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  minW: number;
  minH: number;
};

export type ConstructorKpiItem = {
  label: string;
  value: number;
  hint?: string;
  suffix?: string;
  tone?: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate' | 'lilac' | 'indigo' | 'fuchsia' | 'purple';
  accentColor?: string;
};

export type ConstructorBarPoint = {
  label: string;
  value: number;
};

export type ConstructorStackedSeries = {
  key: string;
  name: string;
  color: string;
};

export type ConstructorPayload =
  | {
      chart: 'kpi';
      items: ConstructorKpiItem[];
      columns: number;
    }
  | {
      chart: 'bar';
      variant: 'columns' | 'bars';
      data: ConstructorBarPoint[];
      colors: string[];
      seriesName: string;
      categoryWidth?: number;
      granularity?: PeriodGranularity;
    }
  | {
      chart: 'stacked';
      data: Array<Record<string, string | number>>;
      series: ConstructorStackedSeries[];
      xKey: string;
      granularity?: PeriodGranularity;
      showLegend?: boolean;
      showStackTotal?: boolean;
      layout?: 'horizontal' | 'vertical';
      grouped?: boolean;
      categoryWidth?: number;
    }
  | {
      chart: 'list';
      items: string[];
      footer?: string;
      emptyMessage?: string;
    }
  | {
      chart: 'donut';
      data: DonutDatum[];
      colorByValue?: boolean;
      variant?: 'pie' | 'ring';
      legendLayout?: 'column' | 'row';
      legendPercentFirst?: boolean;
      labelMode?: 'value' | 'percent' | 'both';
    }
  | {
      chart: 'circles';
      data: DonutDatum[];
      legendLayout?: 'column' | 'row';
    }
  | {
      chart: 'treemap';
      data: TreemapDatum[];
      palette: 'blue' | 'blue-muted' | 'emerald' | 'gray' | 'teal' | 'indigo';
    }
  | {
      chart: 'effectiveness-matrix';
      rows: EffectivenessMatrixRow[];
    }
  | {
      chart: 'materiality-matrix';
      rows: MaterialityMatrixRow[];
    }
  | {
      chart: 'status-matrix';
      rows: StatusMatrixRow[];
    }
  | {
      chart: 'materiality-combined';
      donut: DonutDatum[];
      series: RecommendationPeriodPoint[];
      granularity: PeriodGranularity;
    }
  | {
      chart: 'check-bars';
      variant: 'columns' | 'bars';
      data: DeadlineExtensionByCheckRow[];
      colors: string[];
      shortNames: Record<string, string>;
      seriesName: string;
    }
  | {
      chart: 'documents-closure';
      data: Array<{ name: string; filled: number; empty: number }>;
    }
  | {
      chart: 'auditor-documents-matrix';
      rows: DvaAuditorDocumentRow[];
    }
  | {
      chart: 'auditor-unresolved';
      data: DvaAuditorExecutionRow[];
    }
  | {
      chart: 'check-lifecycle';
      rows: DvaCheckLifecycleRow[];
    };

export type ConstructorWidgetDraft = {
  kind: ConstructorSourceKind;
  sectionId: string;
  title: string;
  description: string;
  filterCaption: string;
  size: Pick<ConstructorWidgetLayout, 'w' | 'h' | 'minW' | 'minH'>;
  payload: ConstructorPayload;
};

export type ConstructorWidget = ConstructorWidgetDraft & {
  instanceId: string;
  layout: ConstructorWidgetLayout;
};

export type ConstructorFilterSnapshot = {
  periodSliceLabel: string;
  periods: string[];
  auditors: string[];
  departments: string[];
};

export type ChecksConstructorInput = {
  selectedSections: string[];
  filterCaption: string;
  summary: ChecksAnalyticsSummary;
  universeTotal: number;
  completionShare: number;
  flowSeries: ChecksAnalyticsPeriodPoint[];
  flowColors: string[];
  granularity: PeriodGranularity;
  viewDistribution: NamedCount[];
  viewColors: string[];
  typeDistribution: NamedCount[];
  departmentMapTop: NamedCount[];
  effectivenessMatrix: EffectivenessMatrixRow[];
};

export type RecommendationsConstructorInput = {
  selectedSections: string[];
  filterCaption: string;
  summary: RecommendationsSummary;
  universeTotal: number;
  completedPeriodSeries: RecommendationPeriodPoint[];
  coloredMaterialityDistribution: DonutDatum[];
  viewDistribution: NamedCount[];
  viewColors: string[];
  objectDistributionTop: NamedCount[];
  materialityMatrix: MaterialityMatrixRow[];
  granularity: PeriodGranularity;
};

export type MonitoringConstructorInput = {
  selectedSections: string[];
  filterCaption: string;
  summary: RecommendationsSummary;
  coloredStatusDistribution: DonutDatum[];
  coloredAdditionalStatusDistribution: DonutDatum[];
  deadlineExtensionsByCheck: DeadlineExtensionByCheckRow[];
  deadlineExtensionColors: string[];
  deadlineExtensionShortNames: Record<string, string>;
  completedDuringAuditByCheck: DeadlineExtensionByCheckRow[];
  completedDuringAuditColors: string[];
  completedDuringAuditShortNames: Record<string, string>;
  statusMatrix: StatusMatrixRow[];
};

export type PlanningConstructorInput = {
  selectedSections: string[];
  filterCaption: string;
  coverage: {
    covered: number;
    uncovered: number;
    total: number;
    coverageRate: number;
    uncoveredRate: number;
    uncoveredDepartments: string[];
  };
  departmentAnalytics: Array<{ name: string; checks: number; recommendations: number }>;
  highMaterialityRanking: NamedCount[];
  highMaterialityTotal: number;
  filteredChecksTotal: number;
  filteredRecommendationsTotal: number;
  universeChecksTotal: number;
  universeRecommendationsTotal: number;
};

export type DvaConstructorInput = {
  selectedSections: string[];
  filterCaption: string;
  checkTotal: number;
  recTotal: number;
  employeeCount: number;
  highMateriality: number;
  averageCheckDurationDays: number;
  auditorChecksMap: AuditorCheckTreemapItem[];
  auditorImpact: DvaAuditorMaterialityRow[];
  auditorExecution: DvaAuditorExecutionRow[];
  auditorTimeliness: DvaAuditorTimelinessRow[];
  auditorDocuments: DvaAuditorDocumentRow[];
  checkLifecycle: DvaCheckLifecycleRow[];
};
