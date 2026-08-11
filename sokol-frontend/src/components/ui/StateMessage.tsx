import { Loader2 } from 'lucide-react';

type StateMessageProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function LoadingState({ title = 'Загрузка...', description, className = '' }: StateMessageProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 ${className}`.trim()}>
      <Loader2 className="w-10 h-10 text-sber-dark animate-spin" />
      <div className="mt-3 text-sm font-medium text-gray-700">{title}</div>
      {description && <div className="mt-1 text-xs text-gray-500">{description}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Ошибка', description, className = '' }: StateMessageProps) {
  return (
    <div
      className={`rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 ${className}`.trim()}
    >
      <div className="font-medium">{title}</div>
      {description && <div className="mt-1 text-sm">{description}</div>}
    </div>
  );
}

export function EmptyState({ title = 'Нет данных', description, className = '' }: StateMessageProps) {
  return (
    <div
      className={`rounded-xl bg-gray-50 p-8 text-center text-gray-500 ${className}`.trim()}
    >
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {description && <div className="mt-1 text-sm text-gray-500">{description}</div>}
    </div>
  );
}
