import { PencilLine, Trash2 } from 'lucide-react';

const BUTTON_CLASS =
  'inline-flex w-[140px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#003366] px-2.5 py-1.5 text-sm font-medium text-[#003366] transition hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white';
const GROUP_CLASS = 'ml-auto flex w-[300px] items-center justify-end gap-2.5 whitespace-nowrap';

type ActionButtonsProps = {
  onEdit: () => void;
  onDelete: () => void;
};

export function ActionButtons({ onEdit, onDelete }: ActionButtonsProps) {
  return (
    <div className={GROUP_CLASS}>
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
