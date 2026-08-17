import type { Check } from '../types/check';
import type { Recommendation } from '../types/recommendation';

export type CheckFormDraft = {
  existingCheck?: Check;
  checkName: string;
  shortName: string;
  checkType: string;
  checkView: string;
  checkLeader: string;
  checkQuarter: string;
  startDate: string | null;
  endDate: string | null;
  orderDocumentNumber: string;
  orderDocumentDate: string | null;
  programDocumentNumber: string;
  programDocumentDate: string | null;
  azDocumentNumber: string;
  azDocumentDate: string | null;
  dzDocumentNumber: string;
  dzDocumentDate: string | null;
  processEffectiveness: string;
  svkEffectiveness: string;
  surEffectiveness: string;
  svikEffectiveness: string;
};

export type CheckFormLocationState = {
  check?: Check;
  restoredDraft?: CheckFormDraft;
};

export type RecommendationFormLocationState = {
  recommendation?: Recommendation;
  serialNumber?: string;
  auditor?: string;
  checkLeader?: string;
  returnTo?: string;
  checkFormDraft?: CheckFormDraft;
};
