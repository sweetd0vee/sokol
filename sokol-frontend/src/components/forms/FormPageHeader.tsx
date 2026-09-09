import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FORM_OUTLINE_BUTTON_CLASS } from '../../constants/formLayout';

type FormPageHeaderProps = {
  title: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function FormPageHeader({
  title,
  backTo,
  backLabel = 'Назад к списку',
  actions,
}: FormPageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-bold text-sber-dark">{title}</h2>
      {actions ?? (backTo ? (
        <Link to={backTo} className={FORM_OUTLINE_BUTTON_CLASS}>
          {backLabel}
        </Link>
      ) : null)}
    </div>
  );
}
