import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { CheckDeleteConfirmDialog } from './CheckDeleteConfirmDialog';
import { FormPageShell } from '../forms/FormPageShell';
import { FormEntityLoadGate } from '../forms/FormEntityLoadGate';
import { FormActionFooter } from '../forms/FormActionFooter';
import { CHECK_QUARTER_OPTIONS, CHECK_TYPE_OPTIONS } from '../../constants/checks';
import { useCheckForm } from '../../hooks/useCheckForm';
import { CheckAttachmentsSection } from './CheckAttachmentsSection';
import { CheckRecommendationsBlock } from './CheckRecommendationsBlock';
import {
  FORM_FIELD_CLASS,
  FORM_FIELD_SPAN_2_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_READONLY_CONTROLS_CLASS,
  FORM_ROW_3,
  FORM_ROW_4,
  FORM_SECTION_CLASS,
  FORM_SECTION_TITLE_CLASS,
  FORM_SERVICE_INPUT_CLASS,
  FORM_STACK_CLASS,
  formControlClass,
  formTextareaClass,
} from '../../constants/formLayout';

export function CheckFormPage() {
  const form = useCheckForm();
  const { fields, setField, requiredFieldErrors, showValidationErrors } = form;

  return (
    <FormEntityLoadGate
      title={form.heading}
      backTo="/checks"
      isLoading={form.isEditMode && !form.existing && form.checkQuery.isLoading}
      isError={form.isEditMode && !form.existing && form.checkQuery.isError}
      error={form.checkQuery.error}
      loadingDescription="Загружаем проверку для редактирования."
      errorTitle="Проверка не загружена"
      errorFallback="Не удалось загрузить проверку для редактирования."
      onRetry={() => void form.checkQuery.refetch()}
    >
    <FormPageShell title={form.heading} backTo="/checks">
      <form
        onSubmit={form.handleSubmit}
        className={`${FORM_STACK_CLASS}${
          form.isEditMode && !form.canManageCheck ? ` ${FORM_READONLY_CONTROLS_CLASS}` : ''
        }`}
      >
        {form.isEditMode && !form.canManageCheck && (
          <p className="text-sm text-gray-600">
            Эту проверку можно только просматривать. Изменять и удалять её могут администратор,
            руководитель проверки и тот, кто её создал.
          </p>
        )}
        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Проверка</div>
          <Textarea
            label="Название"
            value={fields.checkName}
            onChange={(value) => setField('checkName', value)}
            placeholder="Название проверки"
            rows={4}
            labelClassName={FORM_LABEL_CLASS}
            inputClassName={formTextareaClass(showValidationErrors && requiredFieldErrors.checkName)}
          />
          <div className={FORM_ROW_3}>
            <Textarea
              label="Краткое название"
              value={fields.shortName}
              onChange={(value) => setField('shortName', value)}
              placeholder="Краткое название"
              rows={4}
              className={FORM_FIELD_SPAN_2_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formTextareaClass()}
            />
          </div>
          <div className={FORM_ROW_3}>
            <Select
              label="Тип"
              value={fields.checkType}
              onChange={(value) => setField('checkType', value)}
              options={CHECK_TYPE_OPTIONS}
              placeholder="Выберите тип"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.checkType)}
            />
            <Select
              label="Вид"
              value={fields.checkView}
              onChange={(value) => setField('checkView', value)}
              options={form.checkViewOptions}
              placeholder="Выберите вид"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.checkView)}
            />
            <Select
              label="Руководитель проверки"
              value={fields.checkLeader}
              onChange={(value) => setField('checkLeader', value)}
              options={form.leaderOptions}
              placeholder="Выберите руководителя"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.checkLeader)}
            />
          </div>
          <div className={FORM_ROW_4}>
            <DatePicker
              label="Начало"
              selected={fields.startDate}
              onChange={form.handleStartDateChange}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.startDate)}
            />
            <DatePicker
              label="Окончание"
              selected={fields.endDate}
              onChange={(value) => setField('endDate', value)}
              minDate={fields.startDate}
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="Квартал проверки"
              value={fields.checkQuarter}
              onChange={(value) => setField('checkQuarter', value)}
              options={CHECK_QUARTER_OPTIONS}
              placeholder="Выберите квартал"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={formControlClass(showValidationErrors && requiredFieldErrors.checkQuarter)}
            />
            <div className={FORM_FIELD_CLASS}>
              <Input
                label="Ключ"
                value={form.checkKey}
                onChange={() => undefined}
                placeholder=""
                labelClassName={FORM_LABEL_CLASS}
                inputClassName={`${FORM_SERVICE_INPUT_CLASS} tracking-wide text-gray-800`}
                readOnly
              />
              {form.missingKeyFields.length > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  Для автоматической генерации ключа заполните: {form.missingKeyFields.join(', ')}.
                </p>
              )}
              {!form.existing?.serial_number && form.missingKeyFields.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Ключ назначит сервер после сохранения проверки.
                </p>
              )}
              {form.keySourceChanged && (
                <p className="mt-1 text-xs text-gray-500">
                  При сохранении сервер пересчитает ключ и обновит связанные рекомендации.
                </p>
              )}
            </div>
          </div>
          <input type="hidden" name="status" value={form.status} />
        </div>

        <CheckAttachmentsSection
          checkId={form.existing?.id ?? null}
          canModify={form.canManageCheck}
          order={{
            documentNumber: fields.orderDocumentNumber,
            onDocumentNumberChange: (value) => setField('orderDocumentNumber', value),
            documentDate: fields.orderDocumentDate,
            onDocumentDateChange: (value) => setField('orderDocumentDate', value),
          }}
          program={{
            documentNumber: fields.programDocumentNumber,
            onDocumentNumberChange: (value) => setField('programDocumentNumber', value),
            documentDate: fields.programDocumentDate,
            onDocumentDateChange: (value) => setField('programDocumentDate', value),
          }}
          az={{
            documentNumber: fields.azDocumentNumber,
            onDocumentNumberChange: (value) => setField('azDocumentNumber', value),
            documentDate: fields.azDocumentDate,
            onDocumentDateChange: (value) => setField('azDocumentDate', value),
          }}
          dz={{
            documentNumber: fields.dzDocumentNumber,
            onDocumentNumberChange: (value) => setField('dzDocumentNumber', value),
            documentDate: fields.dzDocumentDate,
            onDocumentDateChange: (value) => setField('dzDocumentDate', value),
          }}
        />

        <div className={FORM_SECTION_CLASS}>
          <div className={FORM_SECTION_TITLE_CLASS}>Оценка эффективности</div>
          <div className={FORM_ROW_4}>
            <Select
              label="Процесс"
              value={fields.processEffectiveness}
              onChange={(value) => setField('processEffectiveness', value)}
              options={form.effectivenessOptions}
              placeholder="Выберите оценку"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="СВК"
              value={fields.svkEffectiveness}
              onChange={(value) => setField('svkEffectiveness', value)}
              options={form.effectivenessOptions}
              placeholder="Выберите оценку"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="СУР"
              value={fields.surEffectiveness}
              onChange={(value) => setField('surEffectiveness', value)}
              options={form.effectivenessOptions}
              placeholder="Выберите оценку"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
            <Select
              label="СВИК"
              value={fields.svikEffectiveness}
              onChange={(value) => setField('svikEffectiveness', value)}
              options={form.effectivenessOptions}
              placeholder="Выберите оценку"
              className={FORM_FIELD_CLASS}
              labelClassName={FORM_LABEL_CLASS}
              inputClassName={FORM_INPUT_CLASS}
            />
          </div>
        </div>

        {form.canManageCheck && (
          <CheckRecommendationsBlock
            checkKey={form.checkKey}
            checkLeader={fields.checkLeader}
            checkSaved={form.checkSaved}
            onAddManually={form.handleNavigateToNewRecommendation}
          />
        )}

        <FormActionFooter
          showValidation={showValidationErrors && requiredFieldErrors.hasErrors}
          saveError={form.saveError}
          isSaving={form.isSaving}
          isDeleting={form.isDeleting}
          saveVisible={form.canManageCheck}
          deleteVisible={Boolean(form.isEditMode && form.existing?.id && form.canManageCheck)}
          onDelete={() => form.setDeleteConfirmOpen(true)}
        />
      </form>
      {form.deleteConfirmOpen && form.existing && (
        <CheckDeleteConfirmDialog
          serialNumber={form.existing.serial_number}
          confirmToken={form.deleteConfirmToken}
          recommendationCount={form.linkedRecommendationCount}
          isDeleting={form.isDeleting}
          onConfirm={form.handleConfirmDelete}
          onCancel={() => {
            if (!form.isDeleting) {
              form.setDeleteConfirmOpen(false);
            }
          }}
        />
      )}
    </FormPageShell>
    </FormEntityLoadGate>
  );
}
