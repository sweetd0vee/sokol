import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Recommendation } from '../types/recommendation';
import {
  indicatorFromRecommendationAdditionalStatus,
  indicatorFromRecommendationStatus,
} from '../constants/recommendations';
import { fetchCheckBySerialNumber } from '../api/checks';
import { fetchRecommendation } from '../api/recommendations';
import { getErrorMessage } from '../api/errors';
import { queryKeys } from '../api/queryKeys';
import { useSokolData } from '../contexts/sokolData';
import { useAuth } from './useAuth';
import { useCurrentUserName } from './useCurrentUserName';
import { toNameOptions, useAuditorOptions } from './useReferenceOptions';
import { useAuditObjectOptions } from './useAuditObjectOptions';
import { computeRecommendationAutoStatus } from '../utils/recommendationAutoStatus';
import { toIsoDate } from '../utils/dates';
import { auditorMatchesCurrentUser } from '../utils/personMatch';
import { resolveRecommendationYearlyDisplayNumber } from '../utils/recommendationYearlyNumber';
import {
  type CheckFormLocationState,
  type RecommendationFormLocationState,
} from '../utils/checkFormNavigation';
import { hasIncompleteClosureRows, type RecommendationClosureForm } from '../constants/recommendationClosure';
import {
  buildRecommendationPayload,
  getRecommendationRequiredFieldErrors,
} from '../utils/recommendationFormPayload';
import {
  emptyRecommendationFormFields,
  recommendationFormFieldsFromSource,
  recommendationFormPrefillFromNavigation,
  type RecommendationFormFields,
} from '../utils/recommendationFormState';

export function useRecommendationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = useMemo(
    () => (location.state as RecommendationFormLocationState | null) ?? {},
    [location.state],
  );
  const { checks, recommendations, addRecommendation, updateRecommendation, deleteRecommendation, updateCheck } =
    useSokolData();
  const { isAdmin } = useAuth();
  const myName = useCurrentUserName();
  const isEditMode = Boolean(id);
  const fromCheckForm = Boolean(navigationState.returnTo && navigationState.checkFormDraft);

  const recommendationFromContext = useMemo(
    () => (id ? recommendations.find((item) => String(item.id) === String(id)) : undefined),
    [id, recommendations],
  );

  const { data: fetchedRecommendation, isLoading: isFetching } = useQuery({
    queryKey: queryKeys.recommendation(id),
    queryFn: () => fetchRecommendation(id!),
    enabled: isEditMode && Boolean(id) && !navigationState.recommendation && !recommendationFromContext,
  });

  const source = isEditMode
    ? (navigationState.recommendation ?? recommendationFromContext ?? fetchedRecommendation)
    : navigationState.recommendation;

  const [fields, setFields] = useState<RecommendationFormFields>(() =>
    emptyRecommendationFormFields(recommendationFormPrefillFromNavigation(navigationState)),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isExecutionDeadlineOpen, setIsExecutionDeadlineOpen] = useState(true);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode && source) {
      setFields((prev) => recommendationFormFieldsFromSource(source, prev.checkLeader));
      return;
    }
    if (!isEditMode) {
      setFields(emptyRecommendationFormFields(recommendationFormPrefillFromNavigation(navigationState)));
      setShowValidationErrors(false);
      setIsExecutionDeadlineOpen(true);
    }
  }, [
    source,
    isEditMode,
    navigationState.serialNumber,
    navigationState.auditor,
    navigationState.checkLeader,
    navigationState.checkFormDraft?.checkLeader,
    location.key,
    navigationState,
  ]);

  const resolvedSerialNumber = fields.serialNumber.trim() || source?.serial_number?.trim() || '';

  const linkedCheckFromContext = useMemo(
    () =>
      resolvedSerialNumber
        ? checks.find((check) => check.serial_number === resolvedSerialNumber)
        : undefined,
    [checks, resolvedSerialNumber],
  );

  const { data: fetchedLinkedCheck } = useQuery({
    queryKey: queryKeys.checkBySerial(resolvedSerialNumber),
    queryFn: () => fetchCheckBySerialNumber(resolvedSerialNumber),
    enabled: Boolean(resolvedSerialNumber) && !linkedCheckFromContext,
    staleTime: 60_000,
  });

  const linkedCheck = linkedCheckFromContext ?? fetchedLinkedCheck ?? undefined;

  useEffect(() => {
    if (linkedCheck) {
      setFields((prev) => ({ ...prev, checkLeader: linkedCheck.check_leader ?? '' }));
      return;
    }
    const prefillingLeader =
      navigationState.checkLeader || navigationState.checkFormDraft?.checkLeader || '';
    if (prefillingLeader) {
      setFields((prev) => ({ ...prev, checkLeader: prefillingLeader }));
    }
  }, [
    linkedCheck,
    linkedCheck?.id,
    linkedCheck?.check_leader,
    navigationState.checkLeader,
    navigationState.checkFormDraft?.checkLeader,
  ]);

  const setField = useCallback(<K extends keyof RecommendationFormFields>(
    key: K,
    value: RecommendationFormFields[K],
  ) => {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      if (key !== 'deadline' && key !== 'executionDeadline') {
        return next;
      }
      const auto = computeRecommendationAutoStatus({
        controlDeadline: next.deadline,
        executionDeadline: next.executionDeadline,
        currentStatus: next.status,
        currentAdditionalStatus: next.additionalStatus,
      });
      return {
        ...next,
        status: auto.status ?? next.status,
        indicator: auto.indicator ?? next.indicator,
        additionalStatus: auto.additionalStatus ?? next.additionalStatus,
        additionalIndicator: auto.additionalIndicator ?? next.additionalIndicator,
      };
    });
  }, []);

  const setClosure = useCallback((value: SetStateAction<RecommendationClosureForm>) => {
    setFields((prev) => ({
      ...prev,
      closure: typeof value === 'function' ? value(prev.closure) : value,
    }));
  }, []);

  const checkDisplayName = useMemo(() => {
    if (fromCheckForm && navigationState.checkFormDraft?.checkName.trim()) {
      return navigationState.checkFormDraft.checkName.trim();
    }
    return linkedCheck?.check_name?.trim() ?? '';
  }, [fromCheckForm, linkedCheck?.check_name, navigationState.checkFormDraft?.checkName]);

  const isKeyLocked =
    isEditMode || fromCheckForm || Boolean(navigationState.serialNumber);

  const checkKeyOptions = useMemo(
    () => toNameOptions(checks.map((check) => check.serial_number), fields.serialNumber),
    [checks, fields.serialNumber],
  );

  const sequenceNumber = useMemo(() => {
    if (isEditMode && source?.sequence_number) {
      return source.sequence_number;
    }
    if (!fields.serialNumber) {
      return 1;
    }
    return recommendations.filter((item) => item.serial_number === fields.serialNumber).length + 1;
  }, [fields.serialNumber, isEditMode, recommendations, source?.sequence_number]);

  const displayYearlyNumber = useMemo(
    () =>
      resolveRecommendationYearlyDisplayNumber(recommendations, {
        recommendationId: isEditMode ? source?.id ?? id : null,
        deadline: toIsoDate(fields.deadline) ?? source?.deadline,
        serialNumber: fields.serialNumber,
        fallback: source ?? null,
      }),
    [fields.deadline, fields.serialNumber, id, isEditMode, recommendations, source],
  );

  const { options: auditorOptions } = useAuditorOptions(fields.auditor);
  const { options: leaderOptions } = useAuditorOptions(fields.checkLeader);
  const { options: managerOptions } = useAuditorOptions(fields.manager);
  const { options: auditObjectOptions } = useAuditObjectOptions(fields.auditObject);
  const recommendationId = isEditMode ? (source?.id ?? id ?? null) : null;
  const recommendationAuditor = source?.auditor ?? fields.auditor;
  const canManageRecommendation =
    isAdmin || auditorMatchesCurrentUser(recommendationAuditor, myName);

  const requiredFieldErrors = useMemo(
    () =>
      getRecommendationRequiredFieldErrors({
        description: fields.description,
        auditObject: fields.auditObject,
        deadline: fields.deadline,
        auditor: fields.auditor,
        checkLeader: fields.checkLeader,
        manager: fields.manager,
        indicator: fields.indicator,
        additionalIndicator: fields.additionalIndicator,
        closure: fields.closure,
        hasIncompleteClosureRows,
      }),
    [fields],
  );

  useEffect(() => {
    if (
      showValidationErrors &&
      (requiredFieldErrors.actualCompletionDate || requiredFieldErrors.closureInformation)
    ) {
      setIsExecutionDeadlineOpen(true);
    }
  }, [
    showValidationErrors,
    requiredFieldErrors.actualCompletionDate,
    requiredFieldErrors.closureInformation,
  ]);

  const heading = (() => {
    if (isEditMode) {
      return 'Редактирование рекомендации';
    }
    if (fromCheckForm) {
      return 'Рекомендация к проверке';
    }
    return 'Создание рекомендации';
  })();
  const backToCheckPath = linkedCheck ? `/checks/${linkedCheck.id}/edit` : null;

  const withUpdatedCheckLeaderDraft = (draft: NonNullable<RecommendationFormLocationState['checkFormDraft']>) => ({
    ...draft,
    checkLeader: fields.checkLeader,
  });

  const returnToCheckForm = () => {
    const returnTo = navigationState.returnTo;
    if (!fromCheckForm || !returnTo) {
      return;
    }
    if (!navigationState.checkFormDraft) {
      navigate(returnTo);
      return;
    }
    const returnState: CheckFormLocationState = {
      check: navigationState.checkFormDraft.existingCheck,
      restoredDraft: withUpdatedCheckLeaderDraft(navigationState.checkFormDraft),
    };
    navigate(returnTo, { replace: true, state: returnState });
  };

  const buildPayload = (trimmedDescription: string, resolvedSerial = fields.serialNumber): Recommendation =>
    buildRecommendationPayload({
      isEditMode,
      source,
      serialNumber: resolvedSerial,
      sequenceNumber,
      description: trimmedDescription,
      observationName: fields.observationName,
      auditObject: fields.auditObject,
      deadline: fields.deadline,
      executionDeadline: fields.executionDeadline,
      auditor: fields.auditor,
      checkLeader: fields.checkLeader,
      navigationAuditor: navigationState.auditor,
      manager: fields.manager,
      status: fields.status,
      additionalStatus: fields.additionalStatus,
      indicator: fields.indicator,
      additionalIndicator: fields.additionalIndicator,
      materialityLevel: fields.materialityLevel,
      closure: fields.closure,
    });

  const persistCheckLeaderIfNeeded = async () => {
    if (!linkedCheck || !fields.checkLeader.trim() || fields.checkLeader === linkedCheck.check_leader) {
      return fields.serialNumber;
    }
    const updatedCheck = await updateCheck({ ...linkedCheck, check_leader: fields.checkLeader });
    setField('serialNumber', updatedCheck.serial_number);
    return updatedCheck.serial_number;
  };

  const openCreateAnotherByCheck = (replace = false, nextSerialNumber = fields.serialNumber) => {
    const leader =
      fields.checkLeader || linkedCheck?.check_leader || navigationState.checkLeader || '';
    navigate('/recommendations/new', {
      replace,
      state: {
        serialNumber: nextSerialNumber,
        checkLeader: leader,
      } satisfies RecommendationFormLocationState,
    });
  };

  const saveRecommendation = async (mode: 'save' | 'createAnotherCheckOnly') => {
    const trimmedDescription = fields.description.trim();
    if (isSaving) {
      return;
    }
    setShowValidationErrors(true);
    setSaveError(null);
    if (!fields.serialNumber || !trimmedDescription || !fields.status || !fields.additionalStatus || requiredFieldErrors.hasErrors) {
      return;
    }

    setIsSaving(true);
    try {
      const resolvedSerial = await persistCheckLeaderIfNeeded();
      const payload = buildPayload(trimmedDescription, resolvedSerial);

      if (isEditMode) {
        await updateRecommendation(payload);
        navigate('/recommendations');
        return;
      }

      await addRecommendation(payload);

      if (mode === 'createAnotherCheckOnly') {
        openCreateAnotherByCheck(true, resolvedSerial);
        return;
      }

      if (fromCheckForm && navigationState.checkFormDraft) {
        const returnState: CheckFormLocationState = {
          check: navigationState.checkFormDraft.existingCheck,
          restoredDraft: withUpdatedCheckLeaderDraft(navigationState.checkFormDraft),
        };
        navigate(navigationState.returnTo!, { replace: true, state: returnState });
        return;
      }

      navigate('/recommendations');
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Не удалось сохранить рекомендацию.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveRecommendation('save');
  };

  const handleCreateAnotherCheckOnly = async () => {
    if (isEditMode) {
      openCreateAnotherByCheck();
      return;
    }
    await saveRecommendation('createAnotherCheckOnly');
  };

  const handleConfirmDelete = async () => {
    if (!recommendationId || isDeleting) {
      return;
    }
    setIsDeleting(true);
    setSaveError(null);
    try {
      await deleteRecommendation(String(recommendationId));
      navigate('/recommendations');
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Не удалось удалить рекомендацию.'));
      setDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = (value: string) => {
    const nextStatus = value as Recommendation['status'] | '';
    setFields((prev) => ({
      ...prev,
      status: nextStatus,
      indicator: indicatorFromRecommendationStatus(nextStatus),
    }));
  };

  const handleAdditionalStatusChange = (value: string) => {
    const nextAdditionalStatus = value as Recommendation['additional_status'] | '';
    setFields((prev) => ({
      ...prev,
      additionalStatus: nextAdditionalStatus,
      additionalIndicator: indicatorFromRecommendationAdditionalStatus(nextAdditionalStatus),
    }));
  };

  return {
    isEditMode,
    isFetching,
    source,
    fromCheckForm,
    heading,
    backToCheckPath,
    linkedCheck,
    fields,
    setField,
    isKeyLocked,
    checkKeyOptions,
    checkDisplayName,
    displayYearlyNumber,
    handleStatusChange,
    handleAdditionalStatusChange,
    auditorOptions,
    auditObjectOptions,
    leaderOptions,
    managerOptions,
    setClosure,
    isExecutionDeadlineOpen,
    setIsExecutionDeadlineOpen,
    recommendationId,
    canManageRecommendation,
    requiredFieldErrors,
    showValidationErrors,
    saveError,
    isSaving,
    isDeleting,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    handleSubmit,
    handleCreateAnotherCheckOnly,
    handleConfirmDelete,
    returnToCheckForm,
  };
}
