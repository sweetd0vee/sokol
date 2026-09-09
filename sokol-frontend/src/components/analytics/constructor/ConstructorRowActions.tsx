import { Link } from 'react-router-dom';
import { Check, Copy, Download, MoreHorizontal, PencilLine, Trash2 } from 'lucide-react';

type ConstructorRowActionsProps = {
  dashboardId: string;
  dashboardName: string;
  isActive: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onMakeCurrent: () => void;
  onCopy: () => void;
  onDelete: () => void;
};

export function ConstructorRowActions({
  dashboardId,
  dashboardName,
  isActive,
  menuOpen,
  onToggleMenu,
  onMakeCurrent,
  onCopy,
  onDelete,
}: ConstructorRowActionsProps) {
  return (
    <div className="relative ml-auto flex w-20 items-center justify-end gap-1">
      <Link
        to={`/constructor/${dashboardId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#003366] transition hover:bg-gray-100"
        aria-label={`Редактировать «${dashboardName}»`}
        title="Редактировать"
      >
        <PencilLine size={16} />
      </Link>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu();
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#003366] transition hover:bg-gray-100"
        aria-expanded={menuOpen}
        aria-label={`Ещё действия для «${dashboardName}»`}
        title="Ещё"
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen ? (
        <div
          className="absolute right-0 top-9 z-30 w-52 rounded-lg border border-gray-200 bg-white py-1 text-gray-900 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          {isActive ? null : (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
              onClick={onMakeCurrent}
            >
              <Check size={14} />
              <span>Сделать текущим</span>
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
            onClick={onCopy}
          >
            <Copy size={14} />
            <span>Копировать</span>
          </button>
          <Link
            to={`/constructor/${dashboardId}`}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50"
          >
            <Download size={14} />
            <span>Экспорт</span>
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            onClick={onDelete}
          >
            <Trash2 size={14} />
            <span>Удалить</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
