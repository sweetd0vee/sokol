import { PencilLine, Trash2 } from 'lucide-react';

const BUTTON_CLASS =
  'inline-flex items-center gap-1 rounded-lg border border-sber-dark px-2.5 py-1 text-sm font-medium text-sber-dark transition hover:bg-sber-muted hover:border-sber-muted hover:text-white';

type ActionButtonsProps = {
  onEdit: () => void;
  onDelete: () => void;
};

export function ActionButtons({ onEdit, onDelete }: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onEdit} className={BUTTON_CLASS} aria-label="Редактировать">
        <PencilLine size={14} />
        <span>Редактировать</span>
      </button>
      <button type="button" onClick={onDelete} className={BUTTON_CLASS} aria-label="Удалить">
        <Trash2 size={14} />
        <span>Удалить</span>
      </button>
    </div>
  );
}
