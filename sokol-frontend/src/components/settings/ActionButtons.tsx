import { PencilLine, Trash2 } from 'lucide-react';

const BASE_CLASS =
  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-medium transition';

const VARIANT_CLASS = {
  blue: 'border-sber-light text-sber-light hover:bg-sber-light hover:text-white',
  dark: 'border-sber-dark text-sber-dark hover:bg-sber-muted hover:border-sber-muted hover:text-white',
} as const;

type ActionButtonsProps = {
  onEdit: () => void;
  onDelete: () => void;
  variant?: keyof typeof VARIANT_CLASS;
};

export function ActionButtons({ onEdit, onDelete, variant = 'blue' }: ActionButtonsProps) {
  const className = `${BASE_CLASS} ${VARIANT_CLASS[variant]}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onEdit} className={className} aria-label="Редактировать">
        <PencilLine size={14} />
        <span>Редактировать</span>
      </button>
      <button type="button" onClick={onDelete} className={className} aria-label="Удалить">
        <Trash2 size={14} />
        <span>Удалить</span>
      </button>
    </div>
  );
}
