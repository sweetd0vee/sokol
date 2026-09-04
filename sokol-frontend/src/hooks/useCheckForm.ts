import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCheck } from '../api/checks';
import { getErrorMessage } from '../api/errors';
import { queryKeys } from '../api/queryKeys';
import { useSokolData } from '../contexts/sokolData';
import { useAuth } from './useAuth';
import { useAuditorOptions, useCheckKindOptions, useEffectivenessRatingOptions } from './useReferenceOptions';
import {
  type CheckFormDraft,
  type CheckFormLocationState,
} from '../utils/checkFormNavigation';
import { buildCheckPayload, getCheckRequiredFieldErrors } from '../utils/checkFormPayload';
import {
  applyStartDateChange,
  checkFormFieldsFromCheck,
  deriveCheckStatus,
  getMissingCheckKeyFieldLabels,
  isCheckKeySourceChanged,
  resolveInitialCheckFormFields,
  toCheckFormDraft,
  type CheckFormFields,
} from '../utils/checkFormState';

export function useCheckForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { checks, addCheck, updateCheck, deleteCheck } = useSokolData();
  const { isAdmin } = useAuth();

  const existingFromList = checks.find((item) => item.id === id);
  const locationState = location.state as CheckFormLocationState | null;
  const restoredDraft = locationState?.restoredDraft;
  const existingFromNavigation = locationState?.check ?? restoredDraft?.existingCheck;
  const isEditMode = Boolean(id);
  const existingCandidate = existingFromNavigation ?? existingFromList;
  const checkQuery = useQuery({
    queryKey: queryKeys.check(id),
    queryFn: () => fetchCheck(id ?? ''),
    enabled: isEditMode && Boolean(id) && !existingCandidate,
    retry: false,
  });
  const existing = existingCandidate ?? checkQuery.data;

  const [fields, setFields] = useState<CheckFormFields>(() =>
    resolveInitialCheckFormFields(restoredDraft, existing),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydratedCheckId, setHydratedCheckId] = useState(existing?.id ?? null);

  const { options: leaderOptions } = useAuditorOptions(fields.checkLeader);
  const { options: checkViewOptions } = useCheckKindOptions(fields.checkView);
  const { options: effectivenessOptions } = useEffectivenessRatingOptions(
    fields.processEffectiveness,
    fields.svkEffectiveness,
    fields.surEffectiveness,
    fields.svikEffectiveness,
  );

  const checkSaved = Boolean(isEditMode && existing?.id);

  useEffect(() => {
    if (restoredDraft || !existing?.id || hydratedCheckId === existing.id) {
      return;
    }
    setFields(checkFormFieldsFromCheck(existing));
    setHydratedCheckId(existing.id);
  }, [existing, hydratedCheckId, restoredDraft]);

  const setField = useCallback(<K extends keyof CheckFormFields>(key: K, value: CheckFormFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const heading = isEditMode ? 'Редактирование проверки' : 'Создание проверки';
  const status = deriveCheckStatus(fields.startDate, fields.endDate, existing?.status);

  const handleStartDateChange = (value: Date | null) => {
    setFields((prev) => applyStartDateChange(prev, value));
  };

  const requiredFieldErrors = useMemo(
    () =>
      getCheckRequiredFieldErrors({
        checkName: fields.checkName,
        checkType: fields.checkType,
        checkView: fields.checkView,
        checkLeader: fields.checkLeader,
        checkQuarter: fields.checkQuarter,
        startDate: fields.startDate,
      }),
    [fields.checkName, fields.checkType, fields.checkView, fields.checkLeader, fields.checkQuarter, fields.startDate],
  );

  const missingKeyFields = getMissingCheckKeyFieldLabels(
    fields.startDate,
    fields.checkQuarter,
    fields.checkLeader,
    fields.checkType,
  );
  const checkKey = existing?.serial_number ?? '';
  const keySourceChanged = isCheckKeySourceChanged(existing, fields);

  const buildCheckFormDraft = useCallback(
    (): CheckFormDraft => toCheckFormDraft(fields, existing),
    [existing, fields],
  );

  const handleNavigateToNewRecommendation = useCallback(() => {
    if (!checkKey || !checkSaved) {
      return;
    }
    const returnTo = isEditMode ? `/checks/${id}/edit` : '/checks/new';
    navigate('/recommendations/new', {
      state: {
        serialNumber: checkKey,
        checkLeader: fields.checkLeader,
        returnTo,
        checkFormDraft: buildCheckFormDraft(),
      },
    });
  }, [buildCheckFormDraft, checkKey, checkSaved, fields.checkLeader, id, isEditMode, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    setShowValidationErrors(true);
    setSaveError(null);
    if (requiredFieldErrors.hasErrors) {
      return;
    }
    if (isEditMode && !existing?.id) {
      setSaveError('Проверка не загружена. Обновите страницу или вернитесь к списку проверок.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildCheckPayload({
        existing,
        checkName: fields.checkName,
        shortName: fields.shortName,
        checkType: fields.checkType,
        checkView: fields.checkView,
        checkLeader: fields.checkLeader,
        checkQuarter: fields.checkQuarter,
        startDate: fields.startDate,
        endDate: fields.endDate,
        status,
        orderDocumentNumber: fields.orderDocumentNumber,
        orderDocumentDate: fields.orderDocumentDate,
        programDocumentNumber: fields.programDocumentNumber,
        programDocumentDate: fields.programDocumentDate,
        azDocumentNumber: fields.azDocumentNumber,
        azDocumentDate: fields.azDocumentDate,
        dzDocumentNumber: fields.dzDocumentNumber,
        dzDocumentDate: fields.dzDocumentDate,
        processEffectiveness: fields.processEffectiveness,
        svkEffectiveness: fields.svkEffectiveness,
        surEffectiveness: fields.surEffectiveness,
        svikEffectiveness: fields.svikEffectiveness,
      });

      if (isEditMode) {
        await updateCheck(payload);
        navigate('/checks');
        return;
      }

      const created = await addCheck(payload);
      navigate(`/checks/${created.id}/edit`, { replace: true, state: { check: created } });
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Не удалось сохранить проверку.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!existing?.id || isDeleting) {
      return;
    }
    setIsDeleting(true);
    setSaveError(null);
    try {
      await deleteCheck(existing.id);
      navigate('/checks');
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Не удалось удалить проверку.'));
      setDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    id,
    isEditMode,
    existing,
    checkQuery,
    heading,
    fields,
    setField,
    status,
    checkKey,
    keySourceChanged,
    missingKeyFields,
    requiredFieldErrors,
    showValidationErrors,
    saveError,
    isSaving,
    isDeleting,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    isAdmin,
    leaderOptions,
    checkViewOptions,
    effectivenessOptions,
    handleStartDateChange,
    handleSubmit,
    handleConfirmDelete,
    handleNavigateToNewRecommendation,
    checkSaved,
  };
}
