import { CalendarClock } from 'lucide-react';

export function PlanningTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-sber-dark text-left dark:text-sber-light">Планирование</h2>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-sber-dark/10">
            <CalendarClock className="w-10 h-10 text-sber-dark" />
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
              Планирование проверок
            </h3>
            <p className="mb-4 text-gray-600 dark:text-slate-300">
              Здесь будет размещён календарь и план аудиторских проверок: сроки, ресурсы и статусы
              подготовки.
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sber-dark/10 text-sber-dark text-sm font-medium">
              В разработке
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
