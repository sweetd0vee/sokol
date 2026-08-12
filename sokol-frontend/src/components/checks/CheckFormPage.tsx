import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { ErrorState } from '../ui/StateMessage';
import { getErrorMessage } from '../../api/errors';
import { CHECK_TYPE_OPTIONS, CHECK_VIEW_OPTIONS } from '../../constants/checks';
import { toInputDate, toIsoDate, toStartOfDayMs } from '../../utils/dates';
import { useSokolData } from '../../contexts/sokolData';
import { useAuditorOptions, useEffectivenessRatingOptions } from '../../hooks/useReferenceOptions';
import { CheckAttachmentsSection } from './CheckAttachmentsSection';
import { CheckRecommendationsBlock } from './CheckRecommendationsBlock';
import {
  type CheckFormDraft,
  type CheckFormLocationState,
} from '../../utils/checkFormNavigation';
import { buildCheckPayload, getCheckRequiredFieldErrors } from '../../utils/checkFormPayload';
import {
  FORM_FIELD_CLASS,
  FORM_FIELD_ERROR_CLASS,
  FORM_FIELD_SPAN_2_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_OUTLINE_BUTTON_CLASS,
  FORM_PAGE_CLASS,
  FORM_ROW_3,
  FORM_ROW_4,
  FORM_SAVE_BUTTON_CLASS,
  FORM_SECTION_CLASS,
  FORM_SECTION_TITLE_CLASS,
  FORM_SERVICE_INPUT_CLASS,
  FORM_STACK_CLASS,
  FORM_TEXTAREA_CLASS,
} from '../../constants/formLayout';


export function CheckFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    checks,
    addCheck,
    updateCheck,
  } = useSokolData();
  const existingFromList = checks.find((item) => item.id === id);
  const locationState = location.state as CheckFormLocationState | null;
  const existing = locationState?.check ?? existingFromList;
  const restoredDraft = locationState?.restoredDraft;
  const isEditMode = Boolean(id);
  const existingStartDate = toInputDate(existing?.start_date);
  const [checkName, setCheckName] = useState(restoredDraft?.checkName ?? existing?.check_name ?? '');
  const [shortName, setShortName] = useState(restoredDraft?.shortName ?? existing?.short_name ?? '');
  const [checkType, setCheckType] = useState(restoredDraft?.checkType ?? existing?.check_type ?? '');
  const [checkView, setCheckView] = useState(restoredDraft?.checkView ?? existing?.check_view ?? '');
  const [checkLeader, setCheckLeader] = useState(restoredDraft?.checkLeader ?? existing?.check_leader ?? '');
  const [startDate, setStartDate] = useState<Date | null>(
    restoredDraft ? (restoredDraft.startDate ? toInputDate(restoredDraft.startDate) : null) : existingStartDate,
  );
  const [endDate, setEndDate] = useState<Date | null>(
    restoredDraft ? (restoredDraft.endDate ? toInputDate(restoredDraft.endDate) : null) : toInputDate(existing?.end_date),
  );
  const [orderDocumentNumber, setOrderDocumentNumber] = useState(
    restoredDraft?.orderDocumentNumber ?? existing?.order_document_number ?? '',
  );
  const [orderDocumentDate, setOrderDocumentDate] = useState<Date | null>(
    restoredDraft
      ? (restoredDraft.orderDocumentDate ? toInputDate(restoredDraft.orderDocumentDate) : null)
      : toInputDate(existing?.order_document_date),
  );
  const [programDocumentNumber, setProgramDocumentNumber] = useState(
    restoredDraft?.programDocumentNumber ?? existing?.program_document_number ?? '',
  );
  const [programDocumentDate, setProgramDocumentDate] = useState<Date | null>(
    restoredDraft
      ? (restoredDraft.programDocumentDate ? toInputDate(restoredDraft.programDocumentDate) : null)
      : toInputDate(existing?.program_document_date),
  );
  const [azDocumentNumber, setAzDocumentNumber] = useState(
    restoredDraft?.azDocumentNumber ?? existing?.az_document_number ?? '',
  );
  const [azDocumentDate, setAzDocumentDate] = useState<Date | null>(
    restoredDraft
      ? (restoredDraft.azDocumentDate ? toInputDate(restoredDraft.azDocumentDate) : null)
      : toInputDate(existing?.az_document_date),
  );
  const [dzDocumentNumber, setDzDocumentNumber] = useState(
    restoredDraft?.dzDocumentNumber ?? existing?.dz_document_number ?? '',
  );
  const [dzDocumentDate, setDzDocumentDate] = useState<Date | null>(
    restoredDraft
      ? (restoredDraft.dzDocumentDate ? toInputDate(restoredDraft.dzDocumentDate) : null)
      : toInputDate(existing?.dz_document_date),
  );
  const [processEffectiveness, setProcessEffectiveness] = useState(
    restoredDraft?.processEffectiveness ?? existing?.process_effectiveness ?? '',
  );
  const [svkEffectiveness, setSvkEffectiveness] = useState(
    restoredDraft?.svkEffectiveness ?? existing?.svk_effectiveness ?? '',
  );
  const [surEffectiveness, setSurEffectiveness] = useState(
    restoredDraft?.surEffectiveness ?? existing?.sur_effectiveness ?? '',
  );
  const [svikEffectiveness, setSvikEffectiveness] = useState(
    restoredDraft?.svikEffectiveness ?? existing?.svik_effectiveness ?? '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { options: leaderOptions } = useAuditorOptions(checkLeader);
  const { options: effectivenessOptions } = useEffectivenessRatingOptions(
    processEffectiveness,
    svkEffectiveness,
    surEffectiveness,
    svikEffectiveness,
  );

  const checkSaved = Boolean(isEditMode && existing?.id);

  const heading = isEditMode ? 'Редактирование проверки' : 'Создание проверки';
  const status = (() => {
    if (!startDate) {
      return existing?.status ?? '';
    }
    const selected = toStartOfDayMs(startDate);
    const today = toStartOfDayMs(new Date());
    if (endDate && toStartOfDayMs(endDate) < today) {
      return 'completed';
    }
    return selected > today ? 'not_started' : 'in_progress';
  })();

  const handleStartDateChange = (value: Date | null) => {
    setStartDate(value);
    if (value && endDate && toStartOfDayMs(endDate) < toStartOfDayMs(value)) {
      setEndDate(value);
    }
  };

  const requiredFieldErrors = useMemo(() => {
    return getCheckRequiredFieldErrors({
      checkName,
      checkType,
      checkView,
      checkLeader,
      startDate,
    });
  }, [checkName, checkType, checkView, checkLeader, startDate]);

  const missingKeyFields = [
    !startDate ? 'дату начала' : '',
    !checkLeader ? 'руководителя' : '',
    !checkType ? 'тип' : '',
  ].filter(Boolean);

  const checkKey = existing?.serial_number ?? '';
  const keySourceChanged = Boolean(
    existing?.serial_number
    && (
      checkType !== existing.check_type
      || checkLeader !== existing.check_leader
      || (startDate && existingStartDate && toIsoDate(startDate) !== toIsoDate(existingStartDate))
    ),
  );

  const buildCheckFormDraft = useCallback((): CheckFormDraft => ({
    existingCheck: existing,
    checkName,
    shortName,
    checkType,
    checkView,
    checkLeader,
    startDate: startDate ? (toIsoDate(startDate) ?? null) : null,
    endDate: endDate ? (toIsoDate(endDate) ?? null) : null,
    orderDocumentNumber,
    orderDocumentDate: orderDocumentDate ? (toIsoDate(orderDocumentDate) ?? null) : null,
    programDocumentNumber,
    programDocumentDate: programDocumentDate ? (toIsoDate(programDocumentDate) ?? null) : null,
    azDocumentNumber,
    azDocumentDate: azDocumentDate ? (toIsoDate(azDocumentDate) ?? null) : null,
    dzDocumentNumber,
    dzDocumentDate: dzDocumentDate ? (toIsoDate(dzDocumentDate) ?? null) : null,
    processEffectiveness,
    svkEffectiveness,
    surEffectiveness,
    svikEffectiveness,
  }), [
    existing,
    checkName,
    shortName,
    checkType,
    checkView,
    checkLeader,
    startDate,
    endDate,
    orderDocumentNumber,
    orderDocumentDate,
    programDocumentNumber,
    programDocumentDate,
    azDocumentNumber,
    azDocumentDate,
    dzDocumentNumber,
    dzDocumentDate,
    processEffectiveness,
    svkEffectiveness,
    surEffectiveness,
    svikEffectiveness,
  ]);

  const handleNavigateToNewRecommendation = useCallback(() => {
    if (!checkKey || !checkSaved) {
      return;
    }
    const returnTo = isEditMode ?`/checks/${id}/edit` : '/checks/new';
    navigate('/recommendations/new', {
      state: {
        serialNumber: checkKey,
        checkLeader,
        returnTo,
        checkFormDraft: buildCheckFormDraft(),
      },
    });
  }, [buildCheckFormDraft, checkKey, checkLeader, checkSaved, id, isEditMode, navigate]);

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

    setIsSaving(true);
    try {
      const payload = buildCheckPayload({
        existing,
        checkName,
        shortName,
        checkType,
        checkView,
        checkLeader,
        startDate,
        endDate,
        status,
        orderDocumentNumber,
        orderDocumentDate,
        programDocumentNumber,
        programDocumentDate,
        azDocumentNumber,
        azDocumentDate,
        dzDocumentNumber,
        dzDocumentDate,
        processEffectiveness,
        svkEffectiveness,
        surEffectiveness,
        svikEffectiveness,
      });

      if (isEditMode && existing?.id) {
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
  return (
    <div className={`${FORM_PAGE_CLASS} ${FORM_STACK_CLASS}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-sber-dark">{heading}</h2>
        <Link
          to="/checks"
          className={FORM_OUTLINE_BUTTON_CLASS}
        >
          Назад к списку
        </Link>
      </div>

      <form onSubmit={handleSubmit} className={FORM_STACK_CLASS}>
        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Проверка</div>
          <Textarea
            label="Название"
            value={checkName}
            onChange={setCheckName}
            placeholder="Название проверки"
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={[
              FORM_TEXTAREA_CLASS,
              showValidationErrors && requiredFieldErrors.checkName ? FORM_FIELD_ERROR_CLASS : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          <div className={FORM_ROW_3}>
            <Textarea
              label="Краткое название"
              value={shortName}
              onChange={setShortName}
              placeholder="Краткое название"
              rows={4}
              className={FORM_FIELD_SPAN_2_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_TEXTAREA_CLASS}
            />
          </div>
          <div className={FORM_ROW_3}>
            <Select
              label="Тип"
              value={checkType}
              onChange={setCheckType}
              options={CHECK_TYPE_OPTIONS}
              placeholder="Выберите тип"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_INPUT_CLASS,
                showValidationErrors && requiredFieldErrors.checkType ? FORM_FIELD_ERROR_CLASS : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <Select
              label="Вид"
              value={checkView}
              onChange={setCheckView}
              options={CHECK_VIEW_OPTIONS}
              placeholder="Выберите вид"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_INPUT_CLASS,
                showValidationErrors && requiredFieldErrors.checkView ? FORM_FIELD_ERROR_CLASS : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <Select
              label="Руководитель проверки"
              value={checkLeader}
              onChange={setCheckLeader}
              options={leaderOptions}
              placeholder="Выберите руководителя"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_INPUT_CLASS,
                showValidationErrors && requiredFieldErrors.checkLeader ? FORM_FIELD_ERROR_CLASS : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
          <div className={FORM_ROW_3}>
            <DatePicker
              label="Начало"
              selected={startDate}
              onChange={handleStartDateChange}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={[
                FORM_INPUT_CLASS,
                showValidationErrors && requiredFieldErrors.startDate ? FORM_FIELD_ERROR_CLASS : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <DatePicker
              label="Окончание"
              selected={endDate}
              onChange={setEndDate}
              minDate={startDate}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <div className={FORM_FIELD_CLASS}>
              <Input
                label="Ключ"
                value={checkKey}
                onChange={() => undefined}
                placeholder=""
                labelClassName={FORM_LABEL_CLASS}
                inputClassName={`${FORM_SERVICE_INPUT_CLASS} tracking-wide text-gray-800`}
                readOnly
              />
              {missingKeyFields.length > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  Для автоматической генерации ключа заполните: {missingKeyFields.join(', ')}.
                </p>
              )}
              {!existing?.serial_number && missingKeyFields.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Ключ назначит сервер после сохранения проверки.
                </p>
              )}
              {keySourceChanged && (
                <p className="mt-1 text-xs text-amber-700">
                  При сохранении сервер пересчитает ключ и обновит связанные рекомендации.
                </p>
              )}
            </div>
          </div>
          <input type="hidden" name="status" value={status} />
        </div>

        <CheckAttachmentsSection
          checkId={existing?.id ?? null}
          order={{
            documentNumber: orderDocumentNumber,
            onDocumentNumberChange: setOrderDocumentNumber,
            documentDate: orderDocumentDate,
            onDocumentDateChange: setOrderDocumentDate,
          }}
          program={{
            documentNumber: programDocumentNumber,
            onDocumentNumberChange: setProgramDocumentNumber,
            documentDate: programDocumentDate,
            onDocumentDateChange: setProgramDocumentDate,
          }}
          az={{
            documentNumber: azDocumentNumber,
            onDocumentNumberChange: setAzDocumentNumber,
            documentDate: azDocumentDate,
            onDocumentDateChange: setAzDocumentDate,
          }}
          dz={{
            documentNumber: dzDocumentNumber,
            onDocumentNumberChange: setDzDocumentNumber,
            documentDate: dzDocumentDate,
            onDocumentDateChange: setDzDocumentDate,
          }}
        />

        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Оценка эффективности</div>
          <div className={FORM_ROW_4}>
            <Select
              label="Процесс"
              value={processEffectiveness}
              onChange={setProcessEffectiveness}
              options={effectivenessOptions}
              placeholder="Выберите оценку"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="СВК"
              value={svkEffectiveness}
              onChange={setSvkEffectiveness}
              options={effectivenessOptions}
              placeholder="Выберите оценку"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="СУР"
              value={surEffectiveness}
              onChange={setSurEffectiveness}
              options={effectivenessOptions}
              placeholder="Выберите оценку"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="СВИК"
              value={svikEffectiveness}
              onChange={setSvikEffectiveness}
              options={effectivenessOptions}
              placeholder="Выберите оценку"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
          </div>
        </div>

        <CheckRecommendationsBlock
          checkKey={checkKey}
          checkLeader={checkLeader}
          checkSaved={checkSaved}
          onAddManually={handleNavigateToNewRecommendation}
        />

        <div className="space-y-5">
          {showValidationErrors && requiredFieldErrors.hasErrors && (
            <div className="rounded-lg border border-[#e8b4b4] bg-[#fff3f3] px-4 py-2 text-sm font-medium leading-relaxed text-[#a63d3d]">
              Заполните необходимые поля
            </div>
          )}
          {saveError && <ErrorState description={saveError} />}
          <div className="flex flex-wrap justify-start gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className={`${FORM_SAVE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
