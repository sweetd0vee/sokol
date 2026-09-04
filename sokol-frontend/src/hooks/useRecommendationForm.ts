import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  MaterialityLevel,
  Recommendation,
  RecommendationAdditionalIndicator,
  RecommendationIndicator,
} from '../types/recommendation';
import {
  indicatorFromRecommendationAdditionalStatus,
  indicatorFromRecommendationStatus,
  normalizeRecommendationAdditionalStatus,
  normalizeRecommendationIndicator,
  normalizeRecommendationStatus,
  resolveRecommendationAdditionalIndicator,
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
import { toInputDate, toIsoDate } from '../utils/dates';
import { formatRecommendationAuditObjects } from '../utils/auditObjects';
import { auditorMatchesCurrentUser } from '../utils/personMatch';
import { resolveRecommendationYearlyDisplayNumber } from '../utils/recommendationYearlyNumber';
import {
  type CheckFormLocationState,
  type RecommendationFormLocationState,
} from '../utils/checkFormNavigation';
import {
  createEmptyRecommendationClosure,
  hasIncompleteClosureRows,
  closureFromRecommendation,
  type RecommendationClosureForm,
} from '../constants/recommendationClosure';
import {
  buildRecommendationPayload,
  getRecommendationRequiredFieldErrors,
} from '../utils/recommendationFormPayload';

export function useRecommendationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = (location.state as RecommendationFormLocationState | null) ?? {};
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

  const [serialNumber, setSerialNumber] = useState(
    () => navigationState.serialNumber ?? '',
  );
  const [observationName, setObservationName] = useState('');
  const [description, setDescription] = useState('');
  const [auditObject, setAuditObject] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [auditor, setAuditor] = useState(() => navigationState.auditor ?? '');
  const [checkLeader, setCheckLeader] = useState(
    () =>
      navigationState.checkLeader ||
      navigationState.checkFormDraft?.checkLeader ||
      '',
  );
  const [manager, setManager] = useState('');
  const [status, setStatus] = useState<Recommendation['status'] | ''>('');
  const [additionalStatus, setAdditionalStatus] = useState<Recommendation['additional_status'] | ''>('');
  const [indicator, setIndicator] = useState<RecommendationIndicator>('не указан');
  const [additionalIndicator, setAdditionalIndicator] =
    useState<RecommendationAdditionalIndicator>('не указан');
  const [materialityLevel, setMaterialityLevel] = useState<MaterialityLevel>('средний');
  const [closure, setClosure] = useState<RecommendationClosureForm>(() =>
    createEmptyRecommendationClosure(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isExecutionDeadlineOpen, setIsExecutionDeadlineOpen] = useState(true);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode && source) {
      setSerialNumber(source.serial_number);
      setObservationName(source.observation_name ?? '');
      setDescription(source.description || source.name);
      setAuditObject(formatRecommendationAuditObjects(source.audit_object));
      setDeadline(toInputDate(source.deadline));
      setAuditor(source.auditor);
      setManager(source.manager);
      setStatus(normalizeRecommendationStatus(source.status));
      setAdditionalStatus(normalizeRecommendationAdditionalStatus(source.additional_status));
      setIndicator(normalizeRecommendationIndicator(source.indicator));
      setAdditionalIndicator(
        resolveRecommendationAdditionalIndicator(source.additional_status, source.additional_indicator),
      );
      setMaterialityLevel(source.materiality_level ?? 'средний');
      setClosure(closureFromRecommendation(source));
      return;
    }
    if (!isEditMode) {
      const prefillingLeader =
        navigationState.checkLeader || navigationState.checkFormDraft?.checkLeader || '';
      setSerialNumber(navigationState.serialNumber ?? '');
      setObservationName('');
      setDescription('');
      setAuditObject('');
      setDeadline(null);
      setAuditor(navigationState.auditor ?? '');
      setCheckLeader(prefillingLeader);
      setManager('');
      setStatus('');
      setAdditionalStatus('');
      setIndicator('не указан');
      setAdditionalIndicator('не указан');
      setMaterialityLevel('средний');
      setClosure(createEmptyRecommendationClosure());
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
  ]);

  const resolvedSerialNumber = serialNumber.trim() || source?.serial_number?.trim() || '';

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
      setCheckLeader(linkedCheck.check_leader ?? '');
      return;
    }
    const prefillingLeader =
      navigationState.checkLeader || navigationState.checkFormDraft?.checkLeader || '';
    if (prefillingLeader) {
      setCheckLeader(prefillingLeader);
    }
  }, [
    linkedCheck,
    linkedCheck?.id,
    linkedCheck?.check_leader,
    navigationState.checkLeader,
    navigationState.checkFormDraft?.checkLeader,
  ]);

  const checkDisplayName = useMemo(() => {
    if (fromCheckForm && navigationState.checkFormDraft?.checkName.trim()) {
      return navigationState.checkFormDraft.checkName.trim();
    }
    return linkedCheck?.check_name?.trim() ?? '';
  }, [fromCheckForm, linkedCheck?.check_name, navigationState.checkFormDraft?.checkName]);

  const isKeyLocked =
    isEditMode || fromCheckForm || Boolean(navigationState.serialNumber);

  const checkKeyOptions = useMemo(
    () => toNameOptions(checks.map((check) => check.serial_number), serialNumber),
    [checks, serialNumber],
  );

  const sequenceNumber = useMemo(() => {
    if (isEditMode && source?.sequence_number) {
      return source.sequence_number;
    }
    if (!serialNumber) {
      return 1;
    }
    return recommendations.filter((item) => item.serial_number === serialNumber).length + 1;
  }, [isEditMode, recommendations, serialNumber, source?.sequence_number]);

  const displayYearlyNumber = useMemo(
    () =>
      resolveRecommendationYearlyDisplayNumber(recommendations, {
        recommendationId: isEditMode ? source?.id ?? id : null,
        deadline: toIsoDate(deadline) ?? source?.deadline,
        serialNumber,
        fallback: source ?? null,
      }),
    [deadline, id, isEditMode, recommendations, serialNumber, source],
  );

  const { options: auditorOptions } = useAuditorOptions(auditor);
  const { options: leaderOptions } = useAuditorOptions(checkLeader);
  const { options: managerOptions } = useAuditorOptions(manager);
  const { options: auditObjectOptions } = useAuditObjectOptions(auditObject);
  const recommendationId = isEditMode ? (source?.id ?? id ?? null) : null;
  const recommendationAuditor = source?.auditor ?? auditor;
  const canManageRecommendation =
    isAdmin || auditorMatchesCurrentUser(recommendationAuditor, myName);

  const requiredFieldErrors = useMemo(() => {
    return getRecommendationRequiredFieldErrors({
      description,
      auditObject,
      deadline,
      auditor,
      checkLeader,
      manager,
      indicator,
      additionalIndicator,
      closure,
      hasIncompleteClosureRows,
    });
  }, [additionalIndicator, auditObject, auditor, checkLeader, closure, deadline, description, indicator, manager]);

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
    checkLeader,
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

  const buildPayload = (trimmedDescription: string, resolvedSerial = serialNumber): Recommendation =>
    buildRecommendationPayload({
      isEditMode,
      source,
      serialNumber: resolvedSerial,
      sequenceNumber,
      description: trimmedDescription,
      observationName,
      auditObject,
      deadline,
      auditor,
      checkLeader,
      navigationAuditor: navigationState.auditor,
      manager,
      status,
      additionalStatus,
      indicator,
      additionalIndicator,
      materialityLevel,
      closure,
    });

  const persistCheckLeaderIfNeeded = async () => {
    if (!linkedCheck || !checkLeader.trim() || checkLeader === linkedCheck.check_leader) {
      return serialNumber;
    }
    const updatedCheck = await updateCheck({ ...linkedCheck, check_leader: checkLeader });
    setSerialNumber(updatedCheck.serial_number);
    return updatedCheck.serial_number;
  };

  const openCreateAnotherByCheck = (replace = false, nextSerialNumber = serialNumber) => {
    const leader =
      checkLeader || linkedCheck?.check_leader || navigationState.checkLeader || '';
    navigate('/recommendations/new', {
      replace,
      state: {
        serialNumber: nextSerialNumber,
        checkLeader: leader,
      } satisfies RecommendationFormLocationState,
    });
  };

  const saveRecommendation = async (mode: 'save' | 'createAnotherCheckOnly') => {
    const trimmedDescription = description.trim();
    if (isSaving) {
      return;
    }
    setShowValidationErrors(true);
    setSaveError(null);
    if (!serialNumber || !trimmedDescription || !status || !additionalStatus || requiredFieldErrors.hasErrors) {
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
    setStatus(nextStatus);
    setIndicator(indicatorFromRecommendationStatus(nextStatus));
  };

  const handleAdditionalStatusChange = (value: string) => {
    const nextAdditionalStatus = value as Recommendation['additional_status'] | '';
    setAdditionalStatus(nextAdditionalStatus);
    setAdditionalIndicator(indicatorFromRecommendationAdditionalStatus(nextAdditionalStatus));
  };

  return {
    isEditMode,
    isFetching,
    source,
    fromCheckForm,
    heading,
    backToCheckPath,
    linkedCheck,
    serialNumber,
    setSerialNumber,
    isKeyLocked,
    checkKeyOptions,
    checkDisplayName,
    observationName,
    setObservationName,
    description,
    setDescription,
    displayYearlyNumber,
    status,
    handleStatusChange,
    indicator,
    setIndicator,
    additionalStatus,
    handleAdditionalStatusChange,
    additionalIndicator,
    setAdditionalIndicator,
    auditor,
    setAuditor,
    auditorOptions,
    auditObject,
    setAuditObject,
    auditObjectOptions,
    deadline,
    setDeadline,
    checkLeader,
    setCheckLeader,
    leaderOptions,
    manager,
    setManager,
    managerOptions,
    materialityLevel,
    setMaterialityLevel,
    closure,
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
