import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import type { Check, CheckStatus, CheckType } from '../../types/check';
import { CHECK_TYPE_OPTIONS, CHECK_VIEW_OPTIONS } from '../../constants/checks';
import {
  buildCheckKeySeeds,
  generateCheckSerialNumber,
} from '../../utils/checkKey';
import { toIsoDate, toStartOfDayMs } from '../../utils/dates';
import { useSokolData } from '../../contexts/sokolData';
import { useAuditorOptions, useEffectivenessRatingOptions } from '../../hooks/useReferenceOptions';
import { CheckAttachmentsSection } from './CheckAttachmentsSection';
import { CheckRecommendationsBlock } from './CheckRecommendationsBlock';
import {
  type CheckFormDraft,
  type CheckFormLocationState,
} from '../../utils/checkFormNavigation';
import {
  FORM_FIELD_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_PAGE_CLASS,
  FORM_ROW_3,
  FORM_ROW_4,
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

const FORM_SERVICE_INPUT_CLASS = 'border-2 !border-[#4B5563] bg-green-100 text-sm py-1.5';

function isNonEmpty(value: string | null | undefined) {
  return Boolean(value?.toString().trim());
}

function isDocumentMetaFilled(documentNumber: string, documentDate: Date | null) {
  return isNonEmpty(documentNumber) && Boolean(documentDate);
}

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
  const existing = (location.state as CheckFormLocationState | null)?.check ?? existingFromList;
  const isEditMode = Boolean(id);
  const existingStartDate = toInputDate(existing?.start_date);
  const restoredDraftRef = useRef<CheckFormDraft | null>(null);
  const [checkName, setCheckName] = useState(existing?.check_name ?? '');
  const [checkType, setCheckType] = useState(existing?.check_type ?? '');
  const [checkView, setCheckView] = useState(existing?.check_view ?? '');
  const [checkLeader, setCheckLeader] = useState(existing?.check_leader ?? '');
  const [startDate, setStartDate] = useState<Date | null>(existingStartDate);
  const [endDate, setEndDate] = useState<Date | null>(toInputDate(existing?.end_date));
  const [orderDocumentNumber, setOrderDocumentNumber] = useState(existing?.order_document_number ?? '');
  const [orderDocumentDate, setOrderDocumentDate] = useState<Date | null>(toInputDate(existing?.order_document_date));
  const [programDocumentNumber, setProgramDocumentNumber] = useState(existing?.program_document_number ?? '');
  const [programDocumentDate, setProgramDocumentDate] = useState<Date | null>(toInputDate(existing?.program_document_date));
  const [azDocumentNumber, setAzDocumentNumber] = useState(existing?.az_document_number ?? '');
  const [azDocumentDate, setAzDocumentDate] = useState<Date | null>(toInputDate(existing?.az_document_date));
  const [dzDocumentNumber, setDzDocumentNumber] = useState(existing?.dz_document_number ?? '');
  const [dzDocumentDate, setDzDocumentDate] = useState<Date | null>(toInputDate(existing?.dz_document_date));
  const [processEffectiveness, setProcessEffectiveness] = useState(existing?.process_effectiveness ?? '');
  const [svkEffectiveness, setSvkEffectiveness] = useState(existing?.svk_effectiveness ?? '');
  const [surEffectiveness, setSurEffectiveness] = useState(existing?.sur_effectiveness ?? '');
  const [svikEffectiveness, setSvikEffectiveness] = useState(existing?.svik_effectiveness ?? '');
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

  const missingKeyFields = [
    !startDate ? 'дату начала' : '',
    !checkLeader ? 'руководителя' : '',
    !checkType ? 'тип' : '',
  ].filter(Boolean);

  const checkKey = (() => {
    if (!startDate || !checkLeader || !checkType) {
      return '';
    }
    if (
      existing?.serial_number
      && checkType === existing.check_type
      && checkLeader === existing.check_leader
      && existingStartDate
      && toIsoDate(startDate) === toIsoDate(existingStartDate)
    ) {
      return existing.serial_number;
    }
    const seedChecks = checks
      .filter((item) => item.id !== existing?.id)
      .map(({ serial_number: _serial, ...rest }) => rest);
    return generateCheckSerialNumber({
      startDate,
      checkLeader,
      checkType: checkType as CheckType,
      existing: buildCheckKeySeeds(seedChecks),
    });
  })();

  const isCheckBlockFilled = useMemo(
    () =>
      isNonEmpty(checkName) &&
      isNonEmpty(checkType) &&
      isNonEmpty(checkView) &&
      isNonEmpty(checkLeader) &&
      Boolean(startDate) &&
      Boolean(endDate) &&
      isNonEmpty(checkKey),
    [checkKey, checkLeader, checkName, checkType, checkView, endDate, startDate],
  );

  const isAttachmentsBlockFilled = useMemo(
    () =>
      isDocumentMetaFilled(orderDocumentNumber, orderDocumentDate) &&
      isDocumentMetaFilled(programDocumentNumber, programDocumentDate) &&
      isDocumentMetaFilled(azDocumentNumber, azDocumentDate) &&
      isDocumentMetaFilled(dzDocumentNumber, dzDocumentDate),
    [
      azDocumentDate,
      azDocumentNumber,
      dzDocumentDate,
      dzDocumentNumber,
      orderDocumentDate,
      orderDocumentNumber,
      programDocumentDate,
      programDocumentNumber,
    ],
  );

  const isEffectivenessBlockFilled = useMemo(
    () =>
      isNonEmpty(processEffectiveness) &&
      isNonEmpty(svkEffectiveness) &&
      isNonEmpty(surEffectiveness) &&
      isNonEmpty(svikEffectiveness),
    [processEffectiveness, surEffectiveness, svikEffectiveness, svkEffectiveness],
  );

  useEffect(() => {
    const restoredDraft = (location.state as CheckFormLocationState | null)?.restoredDraft;
    if (!restoredDraft || restoredDraftRef.current === restoredDraft) {
      return;
    }
    restoredDraftRef.current = restoredDraft;

    setCheckName(restoredDraft.checkName);
    setCheckType(restoredDraft.checkType);
    setCheckView(restoredDraft.checkView);
    setCheckLeader(restoredDraft.checkLeader);
    setStartDate(restoredDraft.startDate ? toInputDate(restoredDraft.startDate) : null);
    setEndDate(restoredDraft.endDate ? toInputDate(restoredDraft.endDate) : null);
    setOrderDocumentNumber(restoredDraft.orderDocumentNumber);
    setOrderDocumentDate(
      restoredDraft.orderDocumentDate ? toInputDate(restoredDraft.orderDocumentDate) : null,
    );
    setProgramDocumentNumber(restoredDraft.programDocumentNumber);
    setProgramDocumentDate(
      restoredDraft.programDocumentDate ? toInputDate(restoredDraft.programDocumentDate) : null,
    );
    setAzDocumentNumber(restoredDraft.azDocumentNumber);
    setAzDocumentDate(restoredDraft.azDocumentDate ? toInputDate(restoredDraft.azDocumentDate) : null);
    setDzDocumentNumber(restoredDraft.dzDocumentNumber);
    setDzDocumentDate(restoredDraft.dzDocumentDate ? toInputDate(restoredDraft.dzDocumentDate) : null);
    setProcessEffectiveness(restoredDraft.processEffectiveness);
    setSvkEffectiveness(restoredDraft.svkEffectiveness);
    setSurEffectiveness(restoredDraft.surEffectiveness);
    setSvikEffectiveness(restoredDraft.svikEffectiveness);
  }, [location.state]);

  const buildCheckFormDraft = useCallback((): CheckFormDraft => ({
    existingCheck: existing,
    checkName,
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
    const returnTo = isEditMode ? `/checks/${id}/edit` : '/checks/new';
    navigate('/recommendations/new', {
      state: {
        serialNumber: checkKey,
        auditor: checkLeader,
        returnTo,
        checkFormDraft: buildCheckFormDraft(),
      },
    });
  }, [buildCheckFormDraft, checkKey, checkLeader, checkSaved, id, isEditMode, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!checkKey || !checkType || !checkView || !checkLeader || !startDate) {
      return;
    }

    const payload: Check = {
      id: existing?.id ?? '0',
      serial_number: checkKey,
      check_name: checkName.trim(),
      check_type: checkType as CheckType,
      check_view: checkView as Check['check_view'],
      start_date: toIsoDate(startDate) ?? '',
      end_date: toIsoDate(endDate),
      check_leader: checkLeader,
      status: (status || existing?.status || 'not_started') as CheckStatus,
      created_at: existing?.created_at ?? new Date().toISOString().slice(0, 10),
      description: existing?.description,
      order_document_number: orderDocumentNumber || undefined,
      order_document_date: toIsoDate(orderDocumentDate),
      program_document_number: programDocumentNumber || undefined,
      program_document_date: toIsoDate(programDocumentDate),
      az_document_number: azDocumentNumber || undefined,
      az_document_date: toIsoDate(azDocumentDate),
      dz_document_number: dzDocumentNumber || undefined,
      dz_document_date: toIsoDate(dzDocumentDate),
      process_effectiveness: processEffectiveness || undefined,
      svk_effectiveness: svkEffectiveness || undefined,
      sur_effectiveness: surEffectiveness || undefined,
      svik_effectiveness: svikEffectiveness || undefined,
    };

    if (isEditMode && existing?.id) {
      await updateCheck(payload);
      navigate('/checks');
      return;
    }

    const created = await addCheck(payload);
    navigate(`/checks/${created.id}/edit`, { replace: true, state: { check: created } });
  };
  return (
    <div className={`${FORM_PAGE_CLASS} ${FORM_STACK_CLASS}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-sber-dark">{heading}</h2>
        <Link
          to="/checks"
          className={`inline-flex items-center rounded-lg border-2 border-[#6699FF] px-3 py-1.5 text-sm font-medium text-[#6699FF] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white ${FORM_ACTION_BUTTON_CLASS}`}
        >
          Назад к списку
        </Link>
      </div>

      <form onSubmit={handleSubmit} className={FORM_STACK_CLASS}>
        <div className={formSectionClass(isCheckBlockFilled)}>
          <div className={FORM_SECTION_TITLE_CLASS}>Проверка</div>
          <Textarea
            label="Название"
            value={checkName}
            onChange={setCheckName}
            placeholder="Краткое название"
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName="text-sm py-1.5 min-h-[6.5rem] max-h-48 resize-none overflow-y-auto !border-[#4B5563]"
          />
          <div className={FORM_ROW_3}>
            <Select
              label="Тип"
              value={checkType}
              onChange={setCheckType}
              options={CHECK_TYPE_OPTIONS}
              placeholder="Выберите тип"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="Вид"
              value={checkView}
              onChange={setCheckView}
              options={CHECK_VIEW_OPTIONS}
              placeholder="Выберите вид"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
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
          </div>
          <div className={FORM_ROW_3}>
            <DatePicker
              label="Начало"
              selected={startDate}
              onChange={handleStartDateChange}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
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
                labelClassName={`${FORM_LABEL_CLASS} font-semibold`}
                inputClassName={`${FORM_SERVICE_INPUT_CLASS} font-bold tracking-wide text-gray-800 text-center`}
                readOnly
              />
              {missingKeyFields.length > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  Для автоматической генерации ключа заполните: {missingKeyFields.join(', ')}.
                </p>
              )}
            </div>
          </div>
          <input type="hidden" name="status" value={status} />
        </div>

        <CheckAttachmentsSection
          filled={isAttachmentsBlockFilled}
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

        <div className={formSectionClass(isEffectivenessBlockFilled)}>
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

        <div className="flex flex-wrap justify-start gap-3">
          <button
            type="submit"
            className={`inline-flex items-center rounded-lg bg-[#90EE90] px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] ${FORM_ACTION_BUTTON_CLASS}`}
          >
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}
