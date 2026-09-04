import { Link } from 'react-router-dom';
import { PencilLine } from 'lucide-react';
import { LIST_EDIT_ACTION_CLASS } from '../../constants/formLayout';

export function ListEditActionLink({ to, state }: { to: string; state?: unknown }) {
  return (
    <div className="ml-auto flex w-[160px] items-center justify-end whitespace-nowrap">
      <Link to={to} state={state} className={LIST_EDIT_ACTION_CLASS}>
        <PencilLine size={14} />
        Редактировать
      </Link>
    </div>
  );
}
