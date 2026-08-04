import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { LoadingState } from '../ui/StateMessage';
import type { MaterialityLevel, Recommendation, RecommendationIndicator } from '../../types/recommendation';
import {
  INDICATOR_OPTIONS,
  RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
  getRecommendationAdditionalStatusBadgeClass,
  getRecommendationStatusBadgeClass,
  normalizeRecommendationAdditionalStatus,
  normalizeRecommendationIndicator,
  normalizeRecommendationStatus,
} from '../../constants/recommendations';
import { fetchRecommendation } from '../../api/recommendations';
import { useSokolData } from '../../contexts/sokolData';
import { useAuditorOptions } from '../../hooks/useReferenceOptions';
import { useAuditObjectOptions } from '../../hooks/useAuditObjectOptions';
import { toIsoDate } from '../../utils/dates';
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
  closureToRecommendationFields,
  type RecommendationClosureForm,
} from '../../constants/recommendationClosure';
import {
  FORM_FIELD_CLASS,
  FORM_FIELD_WIDE_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_PAGE_CLASS,
  FORM_ROW_3,
  FORM_ROW_4,
  FORM_SECTION_INNER_STACK_CLASS,
  FORM_SECTION_TITLE_CLASS,
  FORM_STACK_CLASS,
  FORM_ACTION_BUTTON_CLASS,
  formSectionClass,
} from '../../constants/formLayout';

function toInputDate(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildRecommendationName(description: string, sequenceNumber: number) {
  const firstLine = description
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (firstLine) {
    return firstLine.slice(0, 500);
  }
  return `Рекомендация ${sequenceNumber}`;
}

const REQUIRED_FIELD_ERROR_CLASS = 'border-[#e59a9a] focus:border-[#d9534f] focus:ring-[#f3c5c5]';
const FORM_SERVICE_INPUT_CLASS = `${FORM_INPUT_CLASS} bg-green-100`;
const FORM_EQUAL_CONTROL_CLASS = `form-equal-control ${FORM_INPUT_CLASS}`;
const FORM_TEXTAREA_CLASS = `${FORM_INPUT_CLASS} min-h-[6.5rem] max-h-48 resize-none overflow-y-auto`;

function isNonEmpty(value: string | null | undefined) {
  return Boolean(value?.toString().trim());
}

export function RecommendationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = (location.state as RecommendationFormLocationState | null) ?? {};
  const { checks, recommendations, addRecommendation, updateRecommendation, updateCheck } =
    useSokolData();
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

  const source =
    navigationState.recommendation ?? recommendationFromContext ?? fetchedRecommendation;

  const [serialNumber, setSerialNumber] = useState('');
  const [description, setDescription] = useState('');
  const [auditObject, setAuditObject] = useState('');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [auditor, setAuditor] = useState('');
  const [checkLeader, setCheckLeader] = useState(
    () => navigationState.checkFormDraft?.checkLeader ?? '',
  );
  const [manager, setManager] = useState('');
  const [status, setStatus] = useState<Recommendation['status'] | ''>('');
  const [additionalStatus, setAdditionalStatus] = useState<Recommendation['additional_status'] | ''>('');
  const [indicator, setIndicator] = useState<RecommendationIndicator>('не указан');
  const [materialityLevel, setMaterialityLevel] = useState<MaterialityLevel>('средний');
  const [closure, setClosure] = useState<RecommendationClosureForm>(() =>
    createEmptyRecommendationClosure(),
  );
  const [formResetKey, setFormResetKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecutionDeadlineOpen, setIsExecutionDeadlineOpen] = useState(true);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  useEffect(() => {
    if (source) {
      setSerialNumber(source.serial_number);
      setDescription(source.description || source.name);
      setAuditObject(source.audit_object);
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
      setSerialNumber(navigationState.serialNumber ?? '');
      setAuditor(navigationState.auditor ?? '');
    }
  }, [source, isEditMode, navigationState.serialNumber, navigationState.auditor]);

  const linkedCheck = useMemo(
    () => checks.find((check) => check.serial_number === serialNumber),
    [checks, serialNumber],
  );

  useEffect(() => {
    if (linkedCheck) {
      setCheckLeader(linkedCheck.check_leader ?? '');
      return;
    }
    if (navigationState.checkFormDraft?.checkLeader) {
      setCheckLeader(navigationState.checkFormDraft.checkLeader);
    }
  }, [linkedCheck?.id, linkedCheck?.check_leader, navigationState.checkFormDraft?.checkLeader]);

  const checkDisplayName = useMemo(() => {
    if (fromCheckForm && navigationState.checkFormDraft?.checkName.trim()) {
      return navigationState.checkFormDraft.checkName.trim();
    }
    return linkedCheck?.check_name?.trim() ?? '';
  }, [fromCheckForm, linkedCheck?.check_name, navigationState.checkFormDraft?.checkName]);

  const sequenceNumber = useMemo(() => {
    if (isEditMode && source?.sequence_number) {
      return source.sequence_number;
    }
    if (!serialNumber) {
      return 1;
    }
    return recommendations.filter((item) => item.serial_number === serialNumber).length + 1;
  }, [isEditMode, recommendations, serialNumber, source?.sequence_number]);

  const { options: auditorOptions } = useAuditorOptions(auditor);
  const { options: leaderOptions } = useAuditorOptions(checkLeader);
  const { options: managerOptions } = useAuditorOptions(manager);
  const { options: auditObjectOptions } = useAuditObjectOptions(auditObject);
  const requiredFieldErrors = useMemo(() => {
    const descriptionMissing = !description.trim();
    const errors = {
      description: descriptionMissing,
      auditObject: !auditObject,
      deadline: !deadline,
      manager: !manager,
      indicator: !indicator || indicator === 'не указан',
      closureInformation: !closure.closureInformation.trim(),
      actualCompletionDate: !closure.actualCompletionDate,
      extensions: hasIncompleteClosureRows(closure.extensions),
      removals: hasIncompleteClosureRows(closure.removals),
    };
    return {
      ...errors,
      hasErrors: Object.values(errors).some(Boolean),
    };
  }, [auditObject, closure, deadline, description, indicator, manager]);

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

  const isKeyBlockFilled = isNonEmpty(serialNumber);

  const isRecommendationBlockFilled = useMemo(
    () =>
      isNonEmpty(description) &&
      Boolean(status) &&
      Boolean(additionalStatus) &&
      isNonEmpty(auditObject) &&
      Boolean(deadline) &&
      isNonEmpty(auditor) &&
      isNonEmpty(manager) &&
      Boolean(materialityLevel) &&
      Boolean(indicator) &&
      indicator !== 'не указан',
    [
      additionalStatus,
      auditObject,
      auditor,
      deadline,
      description,
      indicator,
      manager,
      materialityLevel,
      status,
    ],
  );

  const isControlZoneFilled = useMemo(() => {
    const rowComplete = (row: { date: string; comment: string }) =>
      isNonEmpty(row.date) && isNonEmpty(row.comment);
    const rowEmpty = (row: { date: string; comment: string }) =>
      !isNonEmpty(row.date) && !isNonEmpty(row.comment);
    const groupComplete = (rows: { date: string; comment: string }[]) =>
      rows.every((row) => rowEmpty(row) || rowComplete(row));

    return (
      isNonEmpty(closure.closureInformation) &&
      isNonEmpty(closure.actualCompletionDate) &&
      groupComplete(closure.extensions) &&
      groupComplete(closure.removals)
    );
  }, [closure]);

  const heading = (() => {
    if (isEditMode) {
      return 'Редактирование рекомендации';
    }
    if (fromCheckForm) {
      return 'Рекомендация к проверке';
    }
    return 'Создание рекомендации';
  })();
  const backPath = fromCheckForm ? navigationState.returnTo! : '/recommendations';
  const backLabel = fromCheckForm ? 'Назад к проверке' : 'Назад к списку';

  const withUpdatedCheckLeaderDraft = (draft: NonNullable<RecommendationFormLocationState['checkFormDraft']>) => ({
    ...draft,
    checkLeader,
  });

  const returnToCheckForm = () => {
    if (!fromCheckForm || !navigationState.checkFormDraft) {
      navigate(backPath);
      return;
    }
    const returnState: CheckFormLocationState = {
      check: navigationState.checkFormDraft.existingCheck,
      restoredDraft: withUpdatedCheckLeaderDraft(navigationState.checkFormDraft),
    };
    navigate(backPath, { replace: true, state: returnState });
  };

  const buildPayload = (trimmedDescription: string): Recommendation => {
    const resolvedAuditor = auditor || checkLeader || navigationState.auditor || 'Не указан';
    const resolvedManager = manager || 'Не указан';
    const resolvedAuditObject = auditObject || 'Не указан';

    return {
      id: source?.id ?? '0',
      serial_number: serialNumber,
      sequence_number: source?.sequence_number ?? sequenceNumber,
      name: buildRecommendationName(trimmedDescription, source?.sequence_number ?? sequenceNumber),
      description: trimmedDescription,
      indicator,
      materiality_level: materialityLevel,
      audit_object: resolvedAuditObject,
      deadline: toIsoDate(deadline) ?? '',
      auditor: resolvedAuditor,
      manager: resolvedManager,
      status: status as Recommendation['status'],
      additional_status: additionalStatus as Recommendation['additional_status'],
      created_at: source?.created_at ?? new Date().toISOString().slice(0, 10),
      ...closureToRecommendationFields(closure),
    };
  };

  const buildCreateAnotherPrefill = () => ({
    serialNumber,
    auditObject,
    auditor: auditor || checkLeader || navigationState.auditor || '',
    manager,
    deadline,
    status,
    additionalStatus,
    indicator,
    materialityLevel,
  });

  const persistCheckLeaderIfNeeded = async () => {
    if (!linkedCheck || !checkLeader.trim() || checkLeader === linkedCheck.check_leader) {
      return;
    }
    await updateCheck({ ...linkedCheck, check_leader: checkLeader });
  };

  const applyCreateAnotherPrefill = (
    prefill: ReturnType<typeof buildCreateAnotherPrefill>,
  ) => {
    setSerialNumber(prefill.serialNumber);
    setAuditObject(prefill.auditObject);
    setAuditor(prefill.auditor);
    setManager(prefill.manager);
    setDeadline(prefill.deadline);
    setStatus(prefill.status);
    setAdditionalStatus(prefill.additionalStatus);
    setIndicator(prefill.indicator);
    setMaterialityLevel(prefill.materialityLevel);
    setDescription('');
    setClosure(createEmptyRecommendationClosure());
    setFormResetKey((current) => current + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCreateAnotherByCheck = (replace = false) => {
    navigate('/recommendations/new', {
      replace,
      state: {
        serialNumber,
        auditor: checkLeader || source?.auditor || navigationState.auditor || '',
      } satisfies RecommendationFormLocationState,
    });
  };

  const saveRecommendation = async (mode: 'save' | 'createAnother' | 'createAnotherCheckOnly') => {
    const trimmedDescription = description.trim();
    if (isSaving) {
      return;
    }
    if (mode === 'save') {
      setShowValidationErrors(true);
    }
    if (!serialNumber || !trimmedDescription || !status || !additionalStatus || requiredFieldErrors.hasErrors) {
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildPayload(trimmedDescription);
      await persistCheckLeaderIfNeeded();

      if (isEditMode) {
        await updateRecommendation(payload);
        navigate('/recommendations');
        return;
      }

      await addRecommendation(payload);

      if (mode === 'createAnother') {
        applyCreateAnotherPrefill(buildCreateAnotherPrefill());
        return;
      }
      if (mode === 'createAnotherCheckOnly') {
        openCreateAnotherByCheck(true);
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
        {fromCheckForm ? (
          <button
            type="button"
            onClick={returnToCheckForm}
            className={`inline-flex items-center rounded-lg border-2 border-[#6699FF] px-3 py-1.5 text-sm font-medium text-[#6699FF] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white ${FORM_ACTION_BUTTON_CLASS}`}
          >
            {backLabel}
          </button>
        ) : (
          <Link
            to={backPath}
            className={`inline-flex items-center rounded-lg border-2 border-[#6699FF] px-3 py-1.5 text-sm font-medium text-[#6699FF] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white ${FORM_ACTION_BUTTON_CLASS}`}
          >
            {backLabel}
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit} className={FORM_STACK_CLASS}>
        <div className={formSectionClass(isKeyBlockFilled)}>
          <div className={FORM_ROW_4}>
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
          </div>

          {serialNumber && (
            <Textarea
              label="Название"
              value={checkDisplayName}
              onChange={() => undefined}
              readOnly
              placeholder="Не указано"
              rows={4}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={`${FORM_TEXTAREA_CLASS} text-gray-800`}
            />
          )}
        </div>

        <div className={formSectionClass(isRecommendationBlockFilled)}>
          <div className={FORM_SECTION_TITLE_CLASS}>Рекомендация</div>

          <div className={FORM_ROW_4}>
            <Input
              label="№"
              value={String(sequenceNumber)}
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
              inputClassName={`${FORM_EQUAL_CONTROL_CLASS} ${getRecommendationStatusBadgeClass(status)}`}
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
              inputClassName={`${FORM_EQUAL_CONTROL_CLASS} ${getRecommendationAdditionalStatusBadgeClass(additionalStatus)}`}
            />
            <IndicatorSelect
              label="Индикатор"
              value={indicator}
              onChange={(value) => setIndicator(value as RecommendationIndicator)}
              options={INDICATOR_OPTIONS}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_EQUAL_CONTROL_CLASS,
                showValidationErrors && requiredFieldErrors.indicator ? REQUIRED_FIELD_ERROR_CLASS : '',
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
              showValidationErrors && requiredFieldErrors.description ? REQUIRED_FIELD_ERROR_CLASS : '',
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
              inputClassName={FORM_INPUT_CLASS}
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
                  ? REQUIRED_FIELD_ERROR_CLASS
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
                  ? REQUIRED_FIELD_ERROR_CLASS
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
                showValidationErrors && requiredFieldErrors.manager ? REQUIRED_FIELD_ERROR_CLASS : '',
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

        <div className={formSectionClass(isControlZoneFilled)}>
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
                        actualCompletionDate: date
                          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                          : '',
                      }))
                    }
                    placeholder="Выберите дату"
                    inputClassName={[
                      FORM_INPUT_CLASS,
                      showValidationErrors && requiredFieldErrors.actualCompletionDate
                        ? REQUIRED_FIELD_ERROR_CLASS
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                  <FileAttachmentsPanel
                    key={formResetKey}
                    embedded
                    compact
                    hideSlotLabel
                    slots={[...RECOMMENDATION_ATTACHMENT_SLOTS]}
                    columnsClassName="grid-cols-1"
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
                        ? REQUIRED_FIELD_ERROR_CLASS
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
              attachmentResetKey={formResetKey}
              value={closure}
              onChange={setClosure}
              inputClassName={FORM_INPUT_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              blockTitleClassName={FORM_SECTION_TITLE_CLASS}
              stackClassName={FORM_SECTION_INNER_STACK_CLASS}
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
          <div className="flex flex-wrap justify-start gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className={`inline-flex items-center rounded-lg bg-[#90EE90] px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] disabled:cursor-not-allowed disabled:opacity-50 ${FORM_ACTION_BUTTON_CLASS}`}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateAnotherCheckOnly()}
              disabled={isSaving}
              className={`inline-flex items-center rounded-lg border-2 border-[#6699FF] px-3 py-1.5 text-sm font-medium text-[#6699FF] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${FORM_ACTION_BUTTON_CLASS}`}
            >
              Создать еще
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
