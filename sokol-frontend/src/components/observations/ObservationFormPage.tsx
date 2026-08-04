import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function ObservationFormPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/observations"
        className="inline-flex items-center gap-2 text-sm font-medium text-sber-dark transition hover:text-[#3B82F6] dark:text-sber-light"
      >
        <ArrowLeft size={16} />
        К списку наблюдений
      </Link>
      <h2 className="text-2xl font-bold text-sber-dark dark:text-sber-light">Наблюдение</h2>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-gray-600 dark:text-slate-300">
          Форма создания и редактирования наблюдения будет доступна после появления API.
        </p>
      </div>
    </div>
  );
}
