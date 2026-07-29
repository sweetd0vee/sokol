import { DatePicker } from '../ui/DatePicker';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import {
  REMOVE_FROM_CONTROL_REASON_OPTIONS,
  type RecommendationClosureForm,
} from '../../constants/recommendationClosure';
import { FORM_FIELD_CLASS, FORM_FIELD_WIDE_CLASS, FORM_ROW_3 } from '../../constants/formLayout';

const EQUAL_CONTROL_CLASS = 'form-equal-control';

type RecommendationClosureSectionProps = {
  value: RecommendationClosureForm;
  onChange: (value: RecommendationClosureForm) => void;
  embedded?: boolean;
  hideClosureInformation?: boolean;
  hideActualCompletionDate?: boolean;
  errorFields?: Partial<Record<keyof RecommendationClosureForm, boolean>>;
  inputClassName?: string;
  labelClassName?: string;
  blockTitleClassName?: string;
  stackClassName?: string;
};

function toDate(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function RecommendationClosureSection({
  value,
  onChange,
  embedded = false,
  hideClosureInformation = false,
  hideActualCompletionDate = false,
  errorFields = {},
  inputClassName = 'text-base py-3',
  labelClassName = 'text-base',
  blockTitleClassName = 'text-base font-semibold text-gray-900',
  stackClassName = 'space-y-6',
}: RecommendationClosureSectionProps) {
  const patch = (partial: Partial<RecommendationClosureForm>) => {
    onChange({ ...value, ...partial });
  };
  const invalidClass = 'border-[#e59a9a] focus:border-[#d9534f] focus:ring-[#f3c5c5]';
  const textareaClassName =
    'text-sm py-1.5 min-h-[6.5rem] max-h-48 resize-none overflow-y-auto';

  const content = (
    <>
      {!hideClosureInformation && (
        <Textarea
          value={value.closureInformation}
          onChange={(closureInformation) => patch({ closureInformation })}
          placeholder="Информация о закрытии"
          rows={4}
          inputClassName={[
            textareaClassName,
            errorFields.closureInformation ? invalidClass : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      )}

      {!hideActualCompletionDate && (
        <DatePicker
          selected={toDate(value.actualCompletionDate)}
          onChange={(date) =>
            patch({
              actualCompletionDate: date
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                : '',
            })
          }
          placeholder="Выберите дату исполнения"
          labelClassName={labelClassName}
          inputClassName={[
            inputClassName,
            errorFields.actualCompletionDate ? invalidClass : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      )}

      <div className={stackClassName}>
        <div className={blockTitleClassName}>Перенос срока</div>
        <div className={`${FORM_ROW_3} items-start`}>
          <div className={FORM_FIELD_CLASS}>
            <DatePicker
              selected={toDate(value.extension1Date)}
              onChange={(date) => patch({ extension1Date: date ? toIsoDate(date) : '' })}
              placeholder="Выберите дату переноса"
              labelClassName={labelClassName}
              inputClassName={[
                inputClassName,
                errorFields.extension1Date ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
          <div className={FORM_FIELD_CLASS}>
            <Textarea
              value={value.extension1Reason}
              onChange={(extension1Reason) => patch({ extension1Reason })}
              placeholder="Укажите причину"
              rows={4}
              labelClassName={labelClassName}
              inputClassName={[
                textareaClassName,
                errorFields.extension1Reason ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
          <div className={FORM_FIELD_WIDE_CLASS}>
            <Textarea
              value={value.extension1Comment}
              onChange={(extension1Comment) => patch({ extension1Comment })}
              placeholder="Комментарий"
              rows={4}
              labelClassName={labelClassName}
              inputClassName={[
                textareaClassName,
                errorFields.extension1Comment ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
        </div>
      </div>

      <div className={stackClassName}>
        <div className={blockTitleClassName}>Снять с контроля</div>
        <div className={`${FORM_ROW_3} items-start`}>
          <div className={FORM_FIELD_CLASS}>
            <DatePicker
              selected={toDate(value.removeFromControlDate)}
              onChange={(date) => patch({ removeFromControlDate: date ? toIsoDate(date) : '' })}
              placeholder="Выберите дату снятия с контроля"
              labelClassName={labelClassName}
              inputClassName={[
                inputClassName,
                EQUAL_CONTROL_CLASS,
                errorFields.removeFromControlDate ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
          <div className={FORM_FIELD_CLASS}>
            <Select
              value={value.removeFromControlReason}
              onChange={(removeFromControlReason) => patch({ removeFromControlReason })}
              options={REMOVE_FROM_CONTROL_REASON_OPTIONS}
              labelClassName={labelClassName}
              inputClassName={[
                inputClassName,
                EQUAL_CONTROL_CLASS,
                errorFields.removeFromControlReason ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
          <div className={FORM_FIELD_WIDE_CLASS}>
            <Textarea
              value={value.removeFromControlComment}
              onChange={(removeFromControlComment) => patch({ removeFromControlComment })}
              placeholder="Комментарий"
              rows={4}
              labelClassName={labelClassName}
              inputClassName={[
                textareaClassName,
                errorFields.removeFromControlComment ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div className={stackClassName}>{content}</div>;
  }

  return (
    <div className={`${stackClassName} rounded-lg border border-gray-200 bg-gray-50 p-4`}>
      {content}
    </div>
  );
}
