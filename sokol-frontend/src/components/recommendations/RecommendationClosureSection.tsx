import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { Textarea } from '../ui/Textarea';
import {
  createClosureDateCommentRow,
  isClosureRowIncomplete,
  type ClosureDateCommentRow,
  type RecommendationClosureForm,
} from '../../constants/recommendationClosure';
import { FORM_ACTION_BUTTON_CLASS, FORM_FIELD_CLASS, FORM_FIELD_WIDE_CLASS, FORM_INPUT_CLASS, FORM_ROW_3, FORM_SECTION_INNER_STACK_CLASS } from '../../constants/formLayout';
import { toIsoDate } from '../../utils/dates';

type RecommendationClosureSectionProps = {
  value: RecommendationClosureForm;
  onChange: (value: RecommendationClosureForm) => void;
  embedded?: boolean;
  hideClosureInformation?: boolean;
  hideActualCompletionDate?: boolean;
  errorFields?: {
    extensions?: boolean;
    removals?: boolean;
  };
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
  `${FORM_INPUT_CLASS} box-border h-full min-h-[9.75rem] flex-1 resize-none overflow-y-auto`;

const ADD_BUTTON_CLASS = `inline-flex items-center gap-1.5 rounded-lg border-2 border-[#6699FF] px-3 py-1.5 text-sm font-medium text-[#6699FF] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white ${FORM_ACTION_BUTTON_CLASS}`;

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

function DateCommentRows({
  rows,
  onChange,
  datePlaceholder,
  showErrors,
  inputClassName,
  labelClassName,
}: {
  rows: ClosureDateCommentRow[];
  onChange: (rows: ClosureDateCommentRow[]) => void;
  datePlaceholder: string;
  showErrors: boolean;
  inputClassName: string;
  labelClassName: string;
}) {
  const invalidClass = 'border-[#e59a9a] focus:border-[#d9534f] focus:ring-[#f3c5c5]';

  const updateRow = (id: string, partial: Partial<Pick<ClosureDateCommentRow, 'date' | 'comment'>>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...partial } : row)));
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) {
      onChange([createClosureDateCommentRow()]);
      return;
    }
    onChange(rows.filter((row) => row.id !== id));
  };

  return (
    <div className={FORM_SECTION_INNER_STACK_CLASS}>
      {rows.map((row) => {
        const incomplete = showErrors && isClosureRowIncomplete(row);
        return (
          <div key={row.id} className={`${FORM_ROW_3} items-start`}>
            <div className={`${FORM_FIELD_CLASS} space-y-3`}>
              <DatePicker
                selected={toDate(row.date)}
                onChange={(date) => updateRow(row.id, { date: toIsoDate(date) ?? '' })}
                placeholder={datePlaceholder}
                labelClassName={labelClassName}
                inputClassName={[inputClassName, incomplete ? invalidClass : '']
                  .filter(Boolean)
                  .join(' ')}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Удалить строку"
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className={`${FORM_FIELD_WIDE_CLASS} flex flex-col self-stretch`}>
              <Textarea
                value={row.comment}
                onChange={(comment) => updateRow(row.id, { comment })}
                placeholder="Комментарий"
                rows={1}
                labelClassName={labelClassName}
                className="flex h-full min-h-0 w-full flex-1 flex-col"
                inputClassName={[COMMENT_TEXTAREA_CLASS, incomplete ? invalidClass : '']
                  .filter(Boolean)
                  .join(' ')}
              />
            </div>
          </div>
        );
      })}
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
  inputClassName = FORM_INPUT_CLASS,
  labelClassName = 'text-sm leading-relaxed',
  blockTitleClassName = 'text-lg font-semibold leading-snug text-gray-900',
  stackClassName = FORM_SECTION_INNER_STACK_CLASS,
}: RecommendationClosureSectionProps) {
  const [extensionOpen, setExtensionOpen] = useState(true);
  const [removeOpen, setRemoveOpen] = useState(true);

  useEffect(() => {
    if (errorFields.extensions) {
      setExtensionOpen(true);
    }
  }, [errorFields.extensions]);

  useEffect(() => {
    if (errorFields.removals) {
      setRemoveOpen(true);
    }
  }, [errorFields.removals]);

  const patch = (partial: Partial<RecommendationClosureForm>) => {
    onChange({ ...value, ...partial });
  };

  const content = (
    <>
      {!hideClosureInformation && (
        <Textarea
          value={value.closureInformation}
          onChange={(closureInformation) => patch({ closureInformation })}
          placeholder="Информация о закрытии"
          rows={4}
          inputClassName={`${FORM_INPUT_CLASS} min-h-[6.5rem] max-h-48 resize-none overflow-y-auto`}
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
          inputClassName={inputClassName}
        />
      )}

      <CollapsibleFormBlock
        title="Перенос срока"
        titleClassName={blockTitleClassName}
        open={extensionOpen}
        onToggle={() => setExtensionOpen((current) => !current)}
        className={stackClassName}
      >
        <div className={FORM_SECTION_INNER_STACK_CLASS}>
          <DateCommentRows
            rows={value.extensions}
            onChange={(extensions) => patch({ extensions })}
            datePlaceholder="Выберите дату переноса"
            showErrors={Boolean(errorFields.extensions)}
            inputClassName={inputClassName}
            labelClassName={labelClassName}
          />
          <button
            type="button"
            onClick={() => patch({ extensions: [...value.extensions, createClosureDateCommentRow()] })}
            className={ADD_BUTTON_CLASS}
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>
      </CollapsibleFormBlock>

      <CollapsibleFormBlock
        title="Снять с контроля"
        titleClassName={blockTitleClassName}
        open={removeOpen}
        onToggle={() => setRemoveOpen((current) => !current)}
        className={stackClassName}
      >
        <div className={FORM_SECTION_INNER_STACK_CLASS}>
          <DateCommentRows
            rows={value.removals}
            onChange={(removals) => patch({ removals })}
            datePlaceholder="Выберите дату снятия с контроля"
            showErrors={Boolean(errorFields.removals)}
            inputClassName={inputClassName}
            labelClassName={labelClassName}
          />
          <button
            type="button"
            onClick={() => patch({ removals: [...value.removals, createClosureDateCommentRow()] })}
            className={ADD_BUTTON_CLASS}
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>
      </CollapsibleFormBlock>
    </>
  );

  if (embedded) {
    return <div className={stackClassName}>{content}</div>;
  }

  return (
    <div className={`${stackClassName} rounded-lg border border-[#b8bec8] bg-white p-5 leading-relaxed`}>
      {content}
    </div>
  );
}
