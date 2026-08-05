import type { MaterialityLevel } from './recommendation';

export type ObservationStatus = 'open' | 'in_progress' | 'closed';

export interface Observation {
  id: string;
  number: string;
  check_serial_number: string;
  name: string;
  chapter: string;
  chapter_title: string;
  materiality_level: MaterialityLevel;
  deadline: string;
  auditor: string;
  status: ObservationStatus;
  recommendation_ids: string[];
}
