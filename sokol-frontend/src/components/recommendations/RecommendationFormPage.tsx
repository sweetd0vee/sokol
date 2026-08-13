import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { ConfirmDialog } from '../ui/Modal';
import type { MaterialityLevel, Recommendation, RecommendationIndicator } from '../../types/recommendation';
import {
  RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
  getRecommendationAdditionalStatusFieldStyle,
  getRecommendationStatusFieldStyle,
  normalizeRecommendationAdditionalStatus,
  normalizeRecommendationIndicator,
  normalizeRecommendationStatus,
} from '../../constants/recommendations';
import { fetchCheckBySerialNumber } from '../../api/checks';
import { fetchRecommendation } from '../../api/recommendations';
import { getErrorMessage } from '../../api/errors';
import { useSokolData } from '../../contexts/sokolData';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { toNameOptions, useAuditorOptions } from '../../hooks/useReferenceOptions';
import { useAuditObjectOptions } from '../../hooks/useAuditObjectOptions';
import { toInputDate, toIsoDate } from '../../utils/dates';
import { formatRecommendationAuditObjects } from '../../utils/auditObjects';
import { auditorMatchesCurrentUser } from '../../utils/personMatch';
import { resolveRecommendationYearlyDisplayNumber } from '../../utils/recommendationYearlyNumber';
import {
  type CheckFormLocationState,
  type RecommendationFormLocationState,
} from '../../utils/checkFormNavigation';
import { MaterialitySelect } from './MaterialitySelect';
import { IndicatorSelect } from './IndicatorSelect';
import { CollapsibleFormBlock, RecommendationClosureSection } from './RecommendationClosureSection';
import { FileAttachmentsPanel } from '../attachments/FileAttachmentsPanel';
import {
  RECOMMENDATION_ATTACHMENT_SLOTS,
  createEmptyRecommendationClosure,
  hasIncompleteClosureRows,
  closureFromRecommendation,
  type RecommendationClosureForm,
} from '../../constants/recommendationClosure';
import {
  buildRecommendationPayload,
  getRecommendationRequiredFieldErrors,
} from '../../utils/recommendationFormPayload';
import {
  FORM_EQUAL_CONTROL_CLASS,
  FORM_FIELD_CLASS,
  FORM_FIELD_ERROR_CLASS,
  FORM_FIELD_WIDE_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_OUTLINE_BUTTON_CLASS,
  FORM_PAGE_CLASS,
  FORM_ROW_3,
  FORM_ROW_4,
  FORM_SAVE_BUTTON_CLASS,
  FORM_SECTION_CLASS,
  FORM_SECTION_INNER_STACK_CLASS,
  FORM_SECTION_TITLE_CLASS,
  FORM_SERVICE_INPUT_CLASS,
  FORM_STACK_CLASS,
  FORM_TEXTAREA_CLASS,
} from '../../constants/formLayout';

export function RecommendationFormPage() {
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
    queryKey: ['recommendation', id],
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
    queryKey: ['check', 'by-serial', resolvedSerialNumber],
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
        fallback: source ?? null,
      }),
    [deadline, id, isEditMode, recommendations, source],
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
      closure,
      hasIncompleteClosureRows,
    });
  }, [auditObject, auditor, checkLeader, closure, deadline, description, indicator, manager]);

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

  const buildPayload = (trimmedDescription: string, resolvedSerialNumber = serialNumber): Recommendation =>
    buildRecommendationPayload({
      isEditMode,
      source,
      serialNumber: resolvedSerialNumber,
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
      const resolvedSerialNumber = await persistCheckLeaderIfNeeded();
      const payload = buildPayload(trimmedDescription, resolvedSerialNumber);

      if (isEditMode) {
        await updateRecommendation(payload);
        navigate('/recommendations');
        return;
      }

      await addRecommendation(payload);

      if (mode === 'createAnotherCheckOnly') {
        openCreateAnotherByCheck(true, resolvedSerialNumber);
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

  if (isEditMode && isFetching && !source) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className={`${FORM_PAGE_CLASS} ${FORM_STACK_CLASS}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-sber-dark">{heading}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(fromCheckForm || (isEditMode && backToCheckPath)) && (
            fromCheckForm ? (
              <button
                type="button"
                onClick={returnToCheckForm}
                className={FORM_OUTLINE_BUTTON_CLASS}
              >
                Назад к проверке
              </button>
            ) : (
              <Link
                to={backToCheckPath!}
                state={{ check: linkedCheck } satisfies CheckFormLocationState}
                className={FORM_OUTLINE_BUTTON_CLASS}
              >
                Назад к проверке
              </Link>
            )
          )}
          {!fromCheckForm && (
            <Link to="/recommendations" className={FORM_OUTLINE_BUTTON_CLASS}>
              Назад к списку
            </Link>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className={FORM_STACK_CLASS}>
        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Проверка</div>
          <div className={FORM_ROW_4}>
            {isKeyLocked ? (
              <Input
                label="Ключ"
                value={serialNumber}
                onChange={() => undefined}
                readOnly
                placeholder="Не указан"
                className={FORM_FIELD_CLASS}
                labelClassName={FORM_LABEL_CLASS}
                inputClassName={`${FORM_SERVICE_INPUT_CLASS} tracking-wide text-gray-800`}
              />
            ) : (
              <Select
                label="Ключ"
                value={serialNumber}
                onChange={setSerialNumber}
                options={checkKeyOptions}
                placeholder="Выберите ключ"
                className={FORM_FIELD_CLASS}
                labelClassName={FORM_LABEL_CLASS}
                inputClassName={[
                  FORM_INPUT_CLASS,
                  showValidationErrors && !serialNumber ? FORM_FIELD_ERROR_CLASS : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            )}
          </div>

          <Textarea
            label="Название"
            value={checkDisplayName}
            onChange={() => undefined}
            readOnly
            placeholder={serialNumber ? 'Не указано' : 'Выберите ключ проверки'}
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={`${FORM_TEXTAREA_CLASS} text-gray-800`}
          />
        </div>

        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Наблюдение</div>
          <Textarea
            value={observationName}
            onChange={setObservationName}
            placeholder="Название наблюдения"
            rows={3}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={FORM_TEXTAREA_CLASS}
          />
        </div>

        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Рекомендация</div>

          <div className={FORM_ROW_4}>
            <Input
              label="№"
              value={displayYearlyNumber !== null ? String(displayYearlyNumber) : '—'}
              onChange={() => undefined}
              readOnly
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_EQUAL_CONTROL_CLASS}
            />
            <Select
              label="Статус"
              value={status}
              onChange={(value) => setStatus(value as Recommendation['status'] | '')}
              options={RECOMMENDATION_STATUS_OPTIONS}
              placeholder="Выберите статус"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_EQUAL_CONTROL_CLASS}
              inputStyle={getRecommendationStatusFieldStyle(status)}
            />
            <Select
              label="Дополнительный статус"
              value={additionalStatus}
              onChange={(value) =>
                setAdditionalStatus(value as Recommendation['additional_status'] | '')
              }
              options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS}
              placeholder="Выберите дополнительный статус"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_EQUAL_CONTROL_CLASS}
              inputStyle={getRecommendationAdditionalStatusFieldStyle(additionalStatus)}
            />
            <IndicatorSelect
              label="Индикатор"
              value={indicator}
              onChange={(value) => setIndicator(value as RecommendationIndicator)}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_EQUAL_CONTROL_CLASS,
                showValidationErrors && requiredFieldErrors.indicator ? FORM_FIELD_ERROR_CLASS : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>

          <Textarea
            value={description}
            onChange={setDescription}
            placeholder="Текст рекомендации"
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={[
              FORM_TEXTAREA_CLASS,
              showValidationErrors && requiredFieldErrors.description ? FORM_FIELD_ERROR_CLASS : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />

          <div className={FORM_ROW_3}>
            <Select
              label="Аудитор"
              value={auditor}
              onChange={setAuditor}
              options={auditorOptions}
              placeholder="Выберите аудитора"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_INPUT_CLASS,
                showValidationErrors && requiredFieldErrors.auditor ? FORM_FIELD_ERROR_CLASS : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <Select
              label="Объект аудита"
              value={auditObject}
              onChange={setAuditObject}
              options={auditObjectOptions}
              placeholder="Выберите объект аудита"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_INPUT_CLASS,
                showValidationErrors && requiredFieldErrors.auditObject
                  ? FORM_FIELD_ERROR_CLASS
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <DatePicker
              label="Срок контроля"
              selected={deadline}
              onChange={setDeadline}
              placeholder="Выберите дату"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_INPUT_CLASS,
                showValidationErrors && requiredFieldErrors.deadline
                  ? FORM_FIELD_ERROR_CLASS
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>

          <div className={FORM_ROW_3}>
            <Select
              label="Руководитель проверки"
              value={checkLeader}
              onChange={setCheckLeader}
              options={leaderOptions}
              placeholder="Выберите руководителя"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="Руководитель объекта аудита"
              value={manager}
              onChange={setManager}
              options={managerOptions}
              placeholder="Выберите руководителя"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_INPUT_CLASS,
                showValidationErrors && requiredFieldErrors.manager ? FORM_FIELD_ERROR_CLASS : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <MaterialitySelect
              label="Уровень существенности"
              value={materialityLevel}
              onChange={(value) => setMaterialityLevel(value as MaterialityLevel)}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
          </div>
        </div>

        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Контрольная зона</div>
          <div className={FORM_SECTION_INNER_STACK_CLASS}>
            <CollapsibleFormBlock
              title="Срок исполнения"
              titleClassName={FORM_SECTION_TITLE_CLASS}
              open={isExecutionDeadlineOpen}
              onToggle={() => setIsExecutionDeadlineOpen((current) => !current)}
              className={FORM_SECTION_INNER_STACK_CLASS}
            >
              <div className={`${FORM_ROW_3} items-start`}>
                <div className={`${FORM_FIELD_CLASS} space-y-5`}>
                  <DatePicker
                    selected={toInputDate(closure.actualCompletionDate)}
                    onChange={(date) =>
                      setClosure((current) => ({
                        ...current,
                        actualCompletionDate: toIsoDate(date) ?? '',
                      }))
                    }
                    placeholder="Выберите дату"
                    inputClassName={[
                      FORM_INPUT_CLASS,
                      showValidationErrors && requiredFieldErrors.actualCompletionDate
                        ? FORM_FIELD_ERROR_CLASS
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                  <FileAttachmentsPanel
                    embedded
                    compact
                    hideSlotLabel
                    entityType="recommendation"
                    entityId={recommendationId}
                    unavailableMessage="Сохраните рекомендацию, чтобы прикрепить файлы."
                    slots={[...RECOMMENDATION_ATTACHMENT_SLOTS]}
                    columnsClassName="grid-cols-1"
                    canModifyAttachments={canManageRecommendation}
                  />
                </div>
                <div className={`${FORM_FIELD_WIDE_CLASS} flex flex-col self-stretch`}>
                  <Textarea
                    value={closure.closureInformation}
                    onChange={(closureInformation) =>
                      setClosure((current) => ({ ...current, closureInformation }))
                    }
                    placeholder="Информация о закрытии"
                    rows={1}
                    className="flex h-full min-h-0 w-full flex-1 flex-col"
                    inputClassName={[
`${FORM_INPUT_CLASS} box-border h-full min-h-0 flex-1 resize-none overflow-y-auto`,
                      showValidationErrors && requiredFieldErrors.closureInformation
                        ? FORM_FIELD_ERROR_CLASS
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                </div>
              </div>
            </CollapsibleFormBlock>
            <RecommendationClosureSection
              embedded
              hideClosureInformation
              hideActualCompletionDate
              recommendationId={recommendationId}
              value={closure}
              onChange={setClosure}
              canModifyAttachments={canManageRecommendation}
              errorFields={
                showValidationErrors
                  ? {
                      extensions: requiredFieldErrors.extensions,
                      removals: requiredFieldErrors.removals,
                    }
                  : {}
              }
            />
          </div>
        </div>

        <div className="space-y-5">
          {showValidationErrors && requiredFieldErrors.hasErrors && (
            <div className="rounded-lg border border-[#e8b4b4] bg-[#fff3f3] px-4 py-2 text-sm font-medium leading-relaxed text-[#a63d3d]">
              Заполните необходимые поля
            </div>
          )}
          {saveError && <ErrorState description={saveError} />}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap justify-start gap-3">
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className={`${FORM_SAVE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateAnotherCheckOnly()}
                disabled={isSaving || isDeleting}
                className={`${FORM_OUTLINE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Создать еще
              </button>
            </div>
            {isEditMode && recommendationId && canManageRecommendation && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isSaving || isDeleting}
                className={`${FORM_OUTLINE_BUTTON_CLASS} gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Trash2 size={14} />
                {isDeleting ? 'Удаление...' : 'Удалить'}
              </button>
            )}
          </div>
        </div>
      </form>
      {deleteConfirmOpen && source && (
        <ConfirmDialog
          title="Удаление рекомендации"
          message={`Вы действительно хотите удалить рекомендацию «${source.name}»?`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </div>
  );
}
