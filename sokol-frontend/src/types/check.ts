export type CheckType = 'planned' | 'unscheduled' | 'thematic';

export type CheckView = 'ИТ' | 'бизнес' | 'риски' | 'корпоуправление' | 'иные';

export type CheckStatus = 'not_started' | 'in_progress' | 'completed';

export interface Check {
  id: string;
  serial_number: string;
  check_name: string;
  check_type: CheckType;
  check_view: CheckView;
  start_date: string;
  end_date?: string;
  check_leader: string;
  status: CheckStatus;
  created_at: string;
  description?: string | null;
  order_document_number?: string;
  order_document_date?: string;
  program_document_number?: string;
  program_document_date?: string;
  az_document_number?: string;
  az_document_date?: string;
  dz_document_number?: string;
  dz_document_date?: string;
  process_effectiveness?: string;
  svk_effectiveness?: string;
  sur_effectiveness?: string;
  svik_effectiveness?: string;
}
