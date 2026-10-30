import type { MaterialityLevel, RecommendationStatus } from '../types/recommendation';

export const MATERIALITY_COLORS: Record<MaterialityLevel, string> = {
  низкий: '#A7F7C2',
  средний: '#FBEB8D',
  высокий: '#FF4347',
};

export const STATUS_COLORS: Record<RecommendationStatus, string> = {
  completed: MATERIALITY_COLORS.низкий,
  unresolved: MATERIALITY_COLORS.высокий,
  on_control: '#64748B',
  in_progress: MATERIALITY_COLORS.средний,
};
