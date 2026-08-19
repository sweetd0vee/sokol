import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { LIST_ACTION_BUTTON_CLASS } from '../../constants/formLayout';

type EntityListHeaderProps = {
  title: string;
  createTo: string;
  showOnlyMe: boolean;
  onToggleOnlyMe: () => void;
};

export function EntityListHeader({
  title,
  createTo,
  showOnlyMe,
  onToggleOnlyMe,
}: EntityListHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-2xl font-bold text-sber-dark text-center sm:text-left">{title}</h2>
      <div className="mx-auto flex w-[334px] shrink-0 items-center justify-center gap-3.5 sm:mx-0 sm:pr-px">
        <button
          type="button"
          onClick={onToggleOnlyMe}
          className={`${LIST_ACTION_BUTTON_CLASS} transition-colors ${
            showOnlyMe
              ? 'bg-[#6699FF] text-white border-2 border-[#6699FF]'
              : 'bg-white text-[#6699FF] border-2 border-[#6699FF] hover:bg-[#3B82F6] hover:border-[#3B82F6] hover:text-white '
          }`}
        >
          <User size={18} />
          Мои
        </button>
        <Link
          to={createTo}
          className={`${LIST_ACTION_BUTTON_CLASS} bg-[#90EE90] text-gray-700 transition hover:bg-[#7fdc7f]`}
        >
          Создать
        </Link>
      </div>
    </div>
  );
}
