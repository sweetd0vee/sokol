import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { Textarea } from '../ui/Textarea';
import { type RecommendationClosureForm } from '../../constants/recommendationClosure';
import { FORM_FIELD_CLASS, FORM_FIELD_WIDE_CLASS, FORM_ROW_3 } from '../../constants/formLayout';
import { toIsoDate } from '../../utils/dates';

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

const COMMENT_TEXTAREA_CLASS =
  'box-border h-full min-h-[9.75rem] flex-1 resize-none overflow-y-auto text-sm py-1.5';

export function CollapsibleFormBlock({
  title,
  titleClassName,
  open,
  onToggle,
  children,
  className = '',
}: {
  title: string;
  titleClassName: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        <ChevronDown
          size={18}
          className={[
            'shrink-0 text-gray-500 transition-transform',
            open ? 'rotate-180' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <span className={titleClassName}>{title}</span>
      </button>
      {open ? children : null}
    </div>
  );
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
  const [extensionOpen, setExtensionOpen] = useState(true);
  const [removeOpen, setRemoveOpen] = useState(true);

  useEffect(() => {
    if (errorFields.extension1Date || errorFields.extension1Comment) {
      setExtensionOpen(true);
    }
  }, [errorFields.extension1Date, errorFields.extension1Comment]);

  useEffect(() => {
    if (errorFields.removeFromControlDate || errorFields.removeFromControlComment) {
      setRemoveOpen(true);
    }
  }, [errorFields.removeFromControlDate, errorFields.removeFromControlComment]);

  const patch = (partial: Partial<RecommendationClosureForm>) => {
    onChange({ ...value, ...partial });
  };
  const invalidClass = 'border-[#e59a9a] focus:border-[#d9534f] focus:ring-[#f3c5c5]';

  const content = (
    <>
      {!hideClosureInformation && (
        <Textarea
          value={value.closureInformation}
          onChange={(closureInformation) => patch({ closureInformation })}
          placeholder="Информация о закрытии"
          rows={4}
          inputClassName={[
            'text-sm py-1.5 min-h-[6.5rem] max-h-48 resize-none overflow-y-auto',
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

      <CollapsibleFormBlock
        title="Перенос срока"
        titleClassName={blockTitleClassName}
        open={extensionOpen}
        onToggle={() => setExtensionOpen((current) => !current)}
        className={stackClassName}
      >
        <div className={`${FORM_ROW_3} items-start`}>
          <div className={FORM_FIELD_CLASS}>
            <DatePicker
              selected={toDate(value.extension1Date)}
              onChange={(date) => patch({ extension1Date: toIsoDate(date) ?? '' })}
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
          <div className={`${FORM_FIELD_WIDE_CLASS} flex flex-col self-stretch`}>
            <Textarea
              value={value.extension1Comment}
              onChange={(extension1Comment) => patch({ extension1Comment })}
              placeholder="Комментарий"
              rows={1}
              labelClassName={labelClassName}
              className="flex h-full min-h-0 w-full flex-1 flex-col"
              inputClassName={[
                COMMENT_TEXTAREA_CLASS,
                errorFields.extension1Comment ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
        </div>
      </CollapsibleFormBlock>

      <CollapsibleFormBlock
        title="Снять с контроля"
        titleClassName={blockTitleClassName}
        open={removeOpen}
        onToggle={() => setRemoveOpen((current) => !current)}
        className={stackClassName}
      >
        <div className={`${FORM_ROW_3} items-start`}>
          <div className={FORM_FIELD_CLASS}>
            <DatePicker
              selected={toDate(value.removeFromControlDate)}
              onChange={(date) => patch({ removeFromControlDate: toIsoDate(date) ?? '' })}
              placeholder="Выберите дату снятия с контроля"
              labelClassName={labelClassName}
              inputClassName={[
                inputClassName,
                errorFields.removeFromControlDate ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
          <div className={`${FORM_FIELD_WIDE_CLASS} flex flex-col self-stretch`}>
            <Textarea
              value={value.removeFromControlComment}
              onChange={(removeFromControlComment) => patch({ removeFromControlComment })}
              placeholder="Комментарий"
              rows={1}
              labelClassName={labelClassName}
              className="flex h-full min-h-0 w-full flex-1 flex-col"
              inputClassName={[
                COMMENT_TEXTAREA_CLASS,
                errorFields.removeFromControlComment ? invalidClass : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
        </div>
      </CollapsibleFormBlock>
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
