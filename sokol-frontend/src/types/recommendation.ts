export type RecommendationStatus = 'completed' | 'unresolved' | 'on_control' | 'in_progress';

export type RecommendationAdditionalStatus = 'on_time' | 'deadline_violated' | 'on_control';

export type MaterialityLevel = 'низкий' | 'средний' | 'высокий';

export type RecommendationIndicator =
  | 'не указан'
  | 'в процессе'
  | 'на контроле'
  | 'не решено'
  | 'исполнено'
  | 'исполнено в ходе аудита';

export type RecommendationAdditionalIndicator =
  | 'не указан'
  | 'в срок'
  | 'срок нарушен'
  | 'на контроле';

export interface Recommendation {
  id: string;
  serial_number: string;
  sequence_number: number;
  name: string;
  observation_name?: string;
  description: string;
  indicator: RecommendationIndicator;
  additional_indicator?: RecommendationAdditionalIndicator;
  materiality_level: MaterialityLevel;
  audit_object: string[];
  deadline: string;
  auditor: string;
  manager: string;
  status: RecommendationStatus;
  additional_status: RecommendationAdditionalStatus;
  created_at?: string;
  actual_completion_date?: string;
  extension_1_reason?: string;
  extension_1_date?: string;
  extension_1_comment?: string;
  extension_2_reason?: string;
  extension_2_comment?: string;
  remove_from_control_reason?: string;
  remove_from_control_date?: string;
  remove_from_control_comment?: string;
  deadline_extensions?: { date?: string | null; comment?: string | null }[];
  control_removals?: { date?: string | null; comment?: string | null }[];
  closure_verification_status?: string;
  closure_information?: string;
}
