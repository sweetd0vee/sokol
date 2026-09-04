import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { ErrorState, LoadingState } from '../ui/StateMessage';
import { ConfirmDialog } from '../ui/Modal';
import type {
  MaterialityLevel,
  RecommendationAdditionalIndicator,
  RecommendationIndicator,
} from '../../types/recommendation';
import {
  ADDITIONAL_INDICATOR_OPTIONS,
  RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS,
  RECOMMENDATION_STATUS_OPTIONS,
  getRecommendationAdditionalStatusFieldStyle,
  getRecommendationStatusFieldStyle,
} from '../../constants/recommendations';
import { toInputDate, toIsoDate } from '../../utils/dates';
import { type CheckFormLocationState } from '../../utils/checkFormNavigation';
import { MaterialitySelect } from './MaterialitySelect';
import { IndicatorSelect } from './IndicatorSelect';
import { ADDITIONAL_INDICATOR_ICONS } from './indicatorIcons';
import { CollapsibleFormBlock, RecommendationClosureSection } from './RecommendationClosureSection';
import { FileAttachmentsPanel } from '../attachments/FileAttachmentsPanel';
import { FormValidationBanner } from '../forms/FormValidationBanner';
import { useRecommendationForm } from '../../hooks/useRecommendationForm';
import { RECOMMENDATION_ATTACHMENT_SLOTS } from '../../constants/recommendationClosure';
import {
  FORM_EQUAL_CONTROL_CLASS,
  FORM_FIELD_CLASS,
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
  formControlClass,
  formEqualControlClass,
  formTextareaClass,
} from '../../constants/formLayout';

export function RecommendationFormPage() {
  const form = useRecommendationForm();
  const { requiredFieldErrors, showValidationErrors } = form;

  if (form.isEditMode && form.isFetching && !form.source) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className={`${FORM_PAGE_CLASS} ${FORM_STACK_CLASS}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-sber-dark">{form.heading}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(form.fromCheckForm || (form.isEditMode && form.backToCheckPath)) && (
            form.fromCheckForm ? (
              <button
                type="button"
                onClick={form.returnToCheckForm}
                className={FORM_OUTLINE_BUTTON_CLASS}
              >
                Назад к проверке
              </button>
            ) : (
              <Link
                to={form.backToCheckPath!}
                state={{ check: form.linkedCheck } satisfies CheckFormLocationState}
                className={FORM_OUTLINE_BUTTON_CLASS}
              >
                Назад к проверке
              </Link>
            )
          )}
          {!form.fromCheckForm && (
            <Link to="/recommendations" className={FORM_OUTLINE_BUTTON_CLASS}>
              Назад к списку
            </Link>
          )}
        </div>
      </div>

      <form onSubmit={form.handleSubmit} className={FORM_STACK_CLASS}>
        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Проверка</div>
          <div className={FORM_ROW_4}>
            {form.isKeyLocked ? (
              <Input
                label="Ключ"
                value={form.serialNumber}
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
                value={form.serialNumber}
                onChange={form.setSerialNumber}
                options={form.checkKeyOptions}
                placeholder="Выберите ключ"
                className={FORM_FIELD_CLASS}
                labelClassName={FORM_LABEL_CLASS}
                inputClassName={formControlClass(showValidationErrors && !form.serialNumber)}
              />
            )}
          </div>

          <Textarea
            label="Название"
            value={form.checkDisplayName}
            onChange={() => undefined}
            readOnly
            placeholder={form.serialNumber ? 'Не указано' : 'Выберите ключ проверки'}
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={`${FORM_TEXTAREA_CLASS} text-gray-800`}
          />
        </div>

        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Наблюдение</div>
          <Textarea
            value={form.observationName}
            onChange={form.setObservationName}
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
              value={form.displayYearlyNumber !== null ? String(form.displayYearlyNumber) : '—'}
              onChange={() => undefined}
              readOnly
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_EQUAL_CONTROL_CLASS}
            />
          </div>

          <Textarea
            value={form.description}
            onChange={form.setDescription}
            placeholder="Текст рекомендации"
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={formTextareaClass(showValidationErrors && requiredFieldErrors.description)}
          />

          <div className={FORM_ROW_4}>
            <Select
              label="Статус"
              value={form.status}
              onChange={form.handleStatusChange}
              options={RECOMMENDATION_STATUS_OPTIONS}
              placeholder="Выберите статус"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_EQUAL_CONTROL_CLASS}
              inputStyle={getRecommendationStatusFieldStyle(form.status)}
            />
            <IndicatorSelect
              label="Индикатор статуса"
              value={form.indicator}
              onChange={(value) => form.setIndicator(value as RecommendationIndicator)}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formEqualControlClass(showValidationErrors && requiredFieldErrors.indicator)}
            />
            <Select
              label="Дополнительный статус"
              value={form.additionalStatus}
              onChange={form.handleAdditionalStatusChange}
              options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS}
              placeholder="Выберите дополнительный статус"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_EQUAL_CONTROL_CLASS}
              inputStyle={getRecommendationAdditionalStatusFieldStyle(form.additionalStatus)}
            />
            <IndicatorSelect
              label="Индикатор дополнительного статуса"
              value={form.additionalIndicator}
              onChange={(value) => form.setAdditionalIndicator(value as RecommendationAdditionalIndicator)}
              options={ADDITIONAL_INDICATOR_OPTIONS}
              icons={ADDITIONAL_INDICATOR_ICONS}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formEqualControlClass(showValidationErrors && requiredFieldErrors.additionalIndicator)}
            />
          </div>

          <div className={FORM_ROW_3}>
            <Select
              label="Аудитор"
              value={form.auditor}
              onChange={form.setAuditor}
              options={form.auditorOptions}
              placeholder="Выберите аудитора"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.auditor)}
            />
            <Select
              label="Объект аудита"
              value={form.auditObject}
              onChange={form.setAuditObject}
              options={form.auditObjectOptions}
              placeholder="Выберите объект аудита"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.auditObject)}
            />
            <DatePicker
              label="Срок контроля"
              selected={form.deadline}
              onChange={form.setDeadline}
              placeholder="Выберите дату"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.deadline)}
            />
          </div>

          <div className={FORM_ROW_3}>
            <Select
              label="Руководитель проверки"
              value={form.checkLeader}
              onChange={form.setCheckLeader}
              options={form.leaderOptions}
              placeholder="Выберите руководителя"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="Руководитель объекта аудита"
              value={form.manager}
              onChange={form.setManager}
              options={form.managerOptions}
              placeholder="Выберите руководителя"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.manager)}
            />
            <MaterialitySelect
              label="Уровень существенности"
              value={form.materialityLevel}
              onChange={(value) => form.setMaterialityLevel(value as MaterialityLevel)}
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
              open={form.isExecutionDeadlineOpen}
              onToggle={() => form.setIsExecutionDeadlineOpen((current) => !current)}
              className={FORM_SECTION_INNER_STACK_CLASS}
            >
              <div className={`${FORM_ROW_3} items-start`}>
                <div className={`${FORM_FIELD_CLASS} space-y-5`}>
                  <DatePicker
                    selected={toInputDate(form.closure.actualCompletionDate)}
                    onChange={(date) =>
                      form.setClosure((current) => ({
                        ...current,
                        actualCompletionDate: toIsoDate(date) ?? '',
                      }))
                    }
                    placeholder="Выберите дату"
                    inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.actualCompletionDate)}
                  />
                  <FileAttachmentsPanel
                    embedded
                    compact
                    hideSlotLabel
                    entityType="recommendation"
                    entityId={form.recommendationId}
                    unavailableMessage="Сохраните рекомендацию, чтобы прикрепить файлы."
                    slots={[...RECOMMENDATION_ATTACHMENT_SLOTS]}
                    columnsClassName="grid-cols-1"
                    canModifyAttachments={form.canManageRecommendation}
                  />
                </div>
                <div className={`${FORM_FIELD_WIDE_CLASS} flex flex-col self-stretch`}>
                  <Textarea
                    value={form.closure.closureInformation}
                    onChange={(closureInformation) =>
                      form.setClosure((current) => ({ ...current, closureInformation }))
                    }
                    placeholder="Информация о закрытии"
                    rows={1}
                    className="flex h-full min-h-0 w-full flex-1 flex-col"
                    inputClassName={formControlClass(
                      showValidationErrors && requiredFieldErrors.closureInformation,
                      'box-border h-full min-h-0 flex-1 resize-none overflow-y-auto',
                    )}
                  />
                </div>
              </div>
            </CollapsibleFormBlock>
            <RecommendationClosureSection
              embedded
              hideClosureInformation
              hideActualCompletionDate
              recommendationId={form.recommendationId}
              value={form.closure}
              onChange={form.setClosure}
              canModifyAttachments={form.canManageRecommendation}
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
          <FormValidationBanner visible={showValidationErrors && requiredFieldErrors.hasErrors} />
          {form.saveError && <ErrorState description={form.saveError} />}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap justify-start gap-3">
              <button
                type="submit"
                disabled={form.isSaving || form.isDeleting}
                className={`${FORM_SAVE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {form.isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => void form.handleCreateAnotherCheckOnly()}
                disabled={form.isSaving || form.isDeleting}
                className={`${FORM_OUTLINE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Создать еще
              </button>
            </div>
            {form.isEditMode && form.recommendationId && form.canManageRecommendation && (
              <button
                type="button"
                onClick={() => form.setDeleteConfirmOpen(true)}
                disabled={form.isSaving || form.isDeleting}
                className={`${FORM_OUTLINE_BUTTON_CLASS} gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Trash2 size={14} />
                {form.isDeleting ? 'Удаление...' : 'Удалить'}
              </button>
            )}
          </div>
        </div>
      </form>
      {form.deleteConfirmOpen && form.source && (
        <ConfirmDialog
          title="Удаление рекомендации"
          message={`Вы действительно хотите удалить рекомендацию «${form.source.name}»?`}
          onConfirm={form.handleConfirmDelete}
          onCancel={() => form.setDeleteConfirmOpen(false)}
        />
      )}
    </div>
  );
}
