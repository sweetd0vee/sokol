import { auditorMatchesCurrentUser, userCanManageCheck, userCanManageRecommendation } from './personMatch';

type RecommendationFormAccessInput = {
  isEditMode: boolean;
  isAdmin: boolean;
  userName: string;
  auditor: string;
  createdBy?: string | null;
  checkLeader?: string | null;
  checkCreatedBy?: string | null;
  hasLinkedCheck: boolean;
  resolvedSerialNumber: string;
};

export function resolveRecommendationFormAccess({
  isEditMode,
  isAdmin,
  userName,
  auditor,
  createdBy,
  checkLeader,
  checkCreatedBy,
  hasLinkedCheck,
  resolvedSerialNumber,
}: RecommendationFormAccessInput) {
  const canManageLinkedCheck = Boolean(
    hasLinkedCheck
    && userCanManageCheck({
      isAdmin,
      userName,
      checkLeader: checkLeader ?? '',
      createdBy: checkCreatedBy,
    }),
  );
  const canEditCheckLeader = isAdmin || canManageLinkedCheck || (!isEditMode && !hasLinkedCheck);
  const recommendationAccessKnown =
    !isEditMode
    || isAdmin
    || auditorMatchesCurrentUser(auditor, userName)
    || auditorMatchesCurrentUser(createdBy ?? '', userName)
    || hasLinkedCheck
    || !resolvedSerialNumber;
  const canManageRecommendation =
    !isEditMode
    || userCanManageRecommendation({
      isAdmin,
      userName,
      auditor,
      createdBy,
      checkLeader: checkLeader ?? undefined,
      checkCreatedBy: checkCreatedBy ?? undefined,
    });

  return {
    canManageLinkedCheck,
    canEditCheckLeader,
    recommendationAccessKnown,
    canManageRecommendation,
  };
}

export function getRecommendationFormHeading(isEditMode: boolean, fromCheckForm: boolean): string {
  if (isEditMode) {
    return 'Редактирование рекомендации';
  }
  if (fromCheckForm) {
    return 'Рекомендация к проверке';
  }
  return 'Создание рекомендации';
}
