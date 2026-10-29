import { useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { Textarea } from '../ui/Textarea';
import { FileAttachmentsPanel } from '../attachments/FileAttachmentsPanel';
import {
  createClosureDateCommentRow,
  isClosureRowIncomplete,
  RECOMMENDATION_CONTROL_REMOVAL_ATTACHMENT_SLOTS,
  type ClosureDateCommentRow,
  type RecommendationClosureForm,
} from '../../constants/recommendationClosure';
import {
  FORM_FIELD_CLASS,
  FORM_FIELD_ERROR_CLASS,
  FORM_FIELD_WIDE_CLASS,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_OUTLINE_BUTTON_CLASS,
  FORM_ROW_3,
  FORM_SECTION_INNER_STACK_CLASS,
  FORM_SECTION_TITLE_CLASS,
  FORM_TEXTAREA_CLASS,
} from '../../constants/formLayout';
import { toInputDate, toIsoDate } from '../../utils/dates';

type RecommendationClosureSectionProps = {
  value: RecommendationClosureForm;
  onChange: (value: RecommendationClosureForm) => void;
  recommendationId?: number | string | null;
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
  canModifyAttachments?: boolean;
};

const COMMENT_TEXTAREA_CLASS =
`${FORM_INPUT_CLASS} box-border h-full min-h-[9.75rem] flex-1 resize-none overflow-y-auto`;

const ADD_BUTTON_CLASS =`${FORM_OUTLINE_BUTTON_CLASS} gap-1.5`;

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
                selected={toInputDate(row.date)}
                onChange={(date) => updateRow(row.id, { date: toIsoDate(date) ?? '' })}
                placeholder={datePlaceholder}
                popperPlacement="top-start"
                labelClassName={labelClassName}
                inputClassName={[inputClassName, incomplete ? FORM_FIELD_ERROR_CLASS : '']
                  .filter(Boolean)
                  .join(' ')}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className={ADD_BUTTON_CLASS}
                  aria-label="Удалить строку"
                >
                  <Trash2 size={16} />
                  Удалить
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
                inputClassName={[COMMENT_TEXTAREA_CLASS, incomplete ? FORM_FIELD_ERROR_CLASS : '']
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
  recommendationId = null,
  embedded = false,
  hideClosureInformation = false,
  hideActualCompletionDate = false,
  errorFields = {},
  inputClassName = FORM_INPUT_CLASS,
  labelClassName = FORM_LABEL_CLASS,
  blockTitleClassName = FORM_SECTION_TITLE_CLASS,
  stackClassName = FORM_SECTION_INNER_STACK_CLASS,
  canModifyAttachments = true,
}: RecommendationClosureSectionProps) {
  const [extensionOpen, setExtensionOpen] = useState(true);
  const [removeOpen, setRemoveOpen] = useState(true);
  const effectiveExtensionOpen = extensionOpen || Boolean(errorFields.extensions);
  const effectiveRemoveOpen = removeOpen || Boolean(errorFields.removals);

  const patch = (partial: Partial<RecommendationClosureForm>) => {
    onChange({ ...value, ...partial });
  };

  const removal = value.removals[0] ?? createClosureDateCommentRow();
  const removalIncomplete = Boolean(errorFields.removals) && isClosureRowIncomplete(removal);
  const updateRemoval = (partial: Partial<Pick<ClosureDateCommentRow, 'date' | 'comment'>>) => {
    const next = { ...removal, ...partial };
    const rest = value.removals.slice(1);
    patch({ removals: [next, ...rest] });
  };

  const content = (
    <>
      {!hideClosureInformation && (
        <Textarea
          value={value.closureInformation}
          onChange={(closureInformation) => patch({ closureInformation })}
          placeholder="Информация о закрытии"
          rows={4}
          inputClassName={FORM_TEXTAREA_CLASS}
        />
      )}

      {!hideActualCompletionDate && (
        <DatePicker
          selected={toInputDate(value.actualCompletionDate)}
          onChange={(date) =>
            patch({
              actualCompletionDate: toIsoDate(date) ?? '',
            })
          }
          placeholder="Выберите дату исполнения"
          labelClassName={labelClassName}
          inputClassName={inputClassName}
        />
      )}

      <CollapsibleFormBlock
        title="Снять с контроля"
        titleClassName={blockTitleClassName}
        open={effectiveRemoveOpen}
        onToggle={() => setRemoveOpen((current) => !current)}
        className={stackClassName}
      >
        <div className={`${FORM_ROW_3} items-start`}>
          <div className={`${FORM_FIELD_CLASS} space-y-5`}>
            <DatePicker
              selected={toInputDate(removal.date)}
              onChange={(date) => updateRemoval({ date: toIsoDate(date) ?? '' })}
              placeholder="Выберите дату снятия с контроля"
              labelClassName={labelClassName}
              inputClassName={[inputClassName, removalIncomplete ? FORM_FIELD_ERROR_CLASS : '']
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
              slots={[...RECOMMENDATION_CONTROL_REMOVAL_ATTACHMENT_SLOTS]}
              columnsClassName="grid-cols-1"
              canModifyAttachments={canModifyAttachments}
            />
          </div>
          <div className={`${FORM_FIELD_WIDE_CLASS} flex flex-col self-stretch`}>
            <Textarea
              value={removal.comment}
              onChange={(comment) => updateRemoval({ comment })}
              placeholder="Комментарий"
              rows={1}
              labelClassName={labelClassName}
              className="flex h-full min-h-0 w-full flex-1 flex-col"
              inputClassName={[
`${FORM_INPUT_CLASS} box-border h-full min-h-0 flex-1 resize-none overflow-y-auto`,
                removalIncomplete ? FORM_FIELD_ERROR_CLASS : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </div>
        </div>
      </CollapsibleFormBlock>

      <CollapsibleFormBlock
        title="Перенос срока"
        titleClassName={blockTitleClassName}
        open={effectiveExtensionOpen}
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
