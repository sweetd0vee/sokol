import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { ErrorState } from '../ui/StateMessage';
import { FormValidationBanner } from './FormValidationBanner';
import { FORM_OUTLINE_BUTTON_CLASS, FORM_SAVE_BUTTON_CLASS } from '../../constants/formLayout';

type FormActionFooterProps = {
  showValidation: boolean;
  saveError: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  extraLeft?: ReactNode;
  deleteVisible?: boolean;
  onDelete?: () => void;
};

export function FormActionFooter({
  showValidation,
  saveError,
  isSaving,
  isDeleting,
  extraLeft,
  deleteVisible = false,
  onDelete,
}: FormActionFooterProps) {
  return (
    <div className="space-y-5">
      <FormValidationBanner visible={showValidation} />
      {saveError && <ErrorState description={saveError} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap justify-start gap-3">
          <button
            type="submit"
            disabled={isSaving || isDeleting}
            className={`${FORM_SAVE_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {extraLeft}
        </div>
        {deleteVisible && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving || isDeleting}
            className={`${FORM_OUTLINE_BUTTON_CLASS} gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Trash2 size={14} />
            {isDeleting ? 'Удаление...' : 'Удалить'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
