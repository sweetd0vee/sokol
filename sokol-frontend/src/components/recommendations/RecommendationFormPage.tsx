import { Link } from 'react-router-dom';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { LoadingState } from '../ui/StateMessage';
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
import { FormPageShell } from '../forms/FormPageShell';
import { FormActionFooter } from '../forms/FormActionFooter';
import { useRecommendationForm } from '../../hooks/useRecommendationForm';
import { RECOMMENDATION_ATTACHMENT_SLOTS } from '../../constants/recommendationClosure';
import {
  FORM_EQUAL_CONTROL_CLASS,
  FORM_FIELD_CLASS,
  FORM_FIELD_WIDE_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_OUTLINE_BUTTON_CLASS,
  FORM_ROW_3,
  FORM_ROW_4,
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
  const { fields, setField, requiredFieldErrors, showValidationErrors } = form;

  if (form.isEditMode && form.isFetching && !form.source) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return (
    <FormPageShell
      title={form.heading}
      actions={(
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
      )}
    >
      <form onSubmit={form.handleSubmit} className={FORM_STACK_CLASS}>
        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Проверка</div>
          <div className={FORM_ROW_4}>
            {form.isKeyLocked ? (
              <Input
                label="Ключ"
                value={fields.serialNumber}
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
                value={fields.serialNumber}
                onChange={(value) => setField('serialNumber', value)}
                options={form.checkKeyOptions}
                placeholder="Выберите ключ"
                className={FORM_FIELD_CLASS}
                labelClassName={FORM_LABEL_CLASS}
                inputClassName={formControlClass(showValidationErrors && !fields.serialNumber)}
              />
            )}
          </div>

          <Textarea
            label="Название"
            value={form.checkDisplayName}
            onChange={() => undefined}
            readOnly
            placeholder={fields.serialNumber ? 'Не указано' : 'Выберите ключ проверки'}
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={`${FORM_TEXTAREA_CLASS} text-gray-800`}
          />
        </div>

        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Наблюдение</div>
          <Textarea
            value={fields.observationName}
            onChange={(value) => setField('observationName', value)}
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
            value={fields.description}
            onChange={(value) => setField('description', value)}
            placeholder="Текст рекомендации"
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={formTextareaClass(showValidationErrors && requiredFieldErrors.description)}
          />

          <div className={FORM_ROW_4}>
            <Select
              label="Статус"
              value={fields.status}
              onChange={form.handleStatusChange}
              options={RECOMMENDATION_STATUS_OPTIONS}
              placeholder="Выберите статус"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_EQUAL_CONTROL_CLASS}
              inputStyle={getRecommendationStatusFieldStyle(fields.status)}
            />
            <IndicatorSelect
              label="Индикатор статуса"
              value={fields.indicator}
              onChange={(value) => setField('indicator', value as RecommendationIndicator)}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formEqualControlClass(showValidationErrors && requiredFieldErrors.indicator)}
            />
            <Select
              label="Дополнительный статус"
              value={fields.additionalStatus}
              onChange={form.handleAdditionalStatusChange}
              options={RECOMMENDATION_ADDITIONAL_STATUS_OPTIONS}
              placeholder="Выберите дополнительный статус"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_EQUAL_CONTROL_CLASS}
              inputStyle={getRecommendationAdditionalStatusFieldStyle(fields.additionalStatus)}
            />
            <IndicatorSelect
              label="Индикатор дополнительного статуса"
              value={fields.additionalIndicator}
              onChange={(value) => setField('additionalIndicator', value as RecommendationAdditionalIndicator)}
              options={ADDITIONAL_INDICATOR_OPTIONS}
              icons={ADDITIONAL_INDICATOR_ICONS}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formEqualControlClass(showValidationErrors && requiredFieldErrors.additionalIndicator)}
            />
          </div>

          <div className={FORM_ROW_4}>
            <Select
              label="Аудитор"
              value={fields.auditor}
              onChange={(value) => setField('auditor', value)}
              options={form.auditorOptions}
              placeholder="Выберите аудитора"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.auditor)}
            />
            <Select
              label="Объект аудита"
              value={fields.auditObject}
              onChange={(value) => setField('auditObject', value)}
              options={form.auditObjectOptions}
              placeholder="Выберите объект аудита"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.auditObject)}
            />
            <DatePicker
              label="Срок контроля"
              selected={fields.deadline}
              onChange={(value) => setField('deadline', value)}
              placeholder="Выберите дату"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.deadline)}
            />
          </div>

          <div className={FORM_ROW_3}>
            <Select
              label="Руководитель проверки"
              value={fields.checkLeader}
              onChange={(value) => setField('checkLeader', value)}
              options={form.leaderOptions}
              placeholder="Выберите руководителя"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="Руководитель объекта аудита"
              value={fields.manager}
              onChange={(value) => setField('manager', value)}
              options={form.managerOptions}
              placeholder="Выберите руководителя"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.manager)}
            />
            <MaterialitySelect
              label="Уровень существенности"
              value={fields.materialityLevel}
              onChange={(value) => setField('materialityLevel', value as MaterialityLevel)}
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
                    selected={toInputDate(fields.closure.actualCompletionDate)}
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
                    value={fields.closure.closureInformation}
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
              value={fields.closure}
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

        <FormActionFooter
          showValidation={showValidationErrors && requiredFieldErrors.hasErrors}
          saveError={form.saveError}
          isSaving={form.isSaving}
          isDeleting={form.isDeleting}
          deleteVisible={Boolean(form.isEditMode && form.recommendationId && form.canManageRecommendation)}
          onDelete={() => form.setDeleteConfirmOpen(true)}
          extraLeft={(
            <button
              type="button"
              onClick={() => void form.handleCreateAnotherCheckOnly()}
              disabled={form.isSaving || form.isDeleting}
              className={`${FORM_OUTLINE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Создать еще
            </button>
          )}
        />
      </form>
      {form.deleteConfirmOpen && form.source && (
        <ConfirmDialog
          title="Удаление рекомендации"
          message={`Вы действительно хотите удалить рекомендацию «${form.source.name}»?`}
          onConfirm={form.handleConfirmDelete}
          onCancel={() => form.setDeleteConfirmOpen(false)}
        />
      )}
    </FormPageShell>
  );
}
