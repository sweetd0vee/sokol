import {
  getLatestDeadlineExtensionDate,
  hasControlRemoval,
} from '../constants/recommendationClosure';
import { toInputDate } from './dates';
import { computeRecommendationAutoStatus } from './recommendationAutoStatus';
import type { RecommendationFormFields } from './recommendationFormState';

/**
 * Перенос срока двигает `deadline` на карточке, затем те же правила автостатуса,
 * что на backend (`docs/RECOMMENDATION_INDICATORS.md`).
 */
export function applyRecommendationFormAutoStatus(
  fields: RecommendationFormFields,
): RecommendationFormFields {
  const extensionIso = getLatestDeadlineExtensionDate({ extensions: fields.closure.extensions });
  const deadline = extensionIso ? toInputDate(extensionIso) : fields.deadline;
  const auto = computeRecommendationAutoStatus({
    controlDeadline: deadline,
    executionDate: fields.closure.actualCompletionDate,
    removedFromControl: hasControlRemoval({ removals: fields.closure.removals }),
    currentIndicator: fields.indicator,
  });
  return {
    ...fields,
    deadline,
    status: auto.status ?? fields.status,
    indicator: auto.indicator ?? fields.indicator,
    additionalStatus: auto.additionalStatus ?? fields.additionalStatus,
    additionalIndicator: auto.additionalIndicator ?? fields.additionalIndicator,
  };
}
