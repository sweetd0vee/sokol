import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/classNames';

type StateMessageProps = {
  title?: string;
  description?: string;
  className?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function LoadingState({ title = 'Загрузка...', description, className = '' }: StateMessageProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16', className)}>
      <Loader2 className="w-10 h-10 text-sber-dark animate-spin" />
      <div className="mt-3 text-sm font-medium text-gray-700">{title}</div>
      {description && <div className="mt-1 text-xs text-gray-500">{description}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Ошибка', description, className = '', action }: StateMessageProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-xl border border-red-200 bg-red-50 p-4 text-red-700', className)}
    >
      <div className="font-medium">{title}</div>
      {description && <div className="mt-1 text-sm">{description}</div>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'Нет данных', description, className = '' }: StateMessageProps) {
  return (
    <div
      className={cn('rounded-xl bg-gray-50 p-8 text-center text-gray-500', className)}
    >
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {description && <div className="mt-1 text-sm text-gray-500">{description}</div>}
    </div>
  );
}
