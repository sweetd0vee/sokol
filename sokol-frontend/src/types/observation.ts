import type { MaterialityLevel } from './recommendation';

export type ObservationStatus = 'open' | 'in_progress' | 'closed';

export interface Observation {
  id: string;
  serial_number: string;
  name: string;
  chapter: string;
  materiality_level: MaterialityLevel;
  deadline: string;
  auditor: string;
  status: ObservationStatus;
}
