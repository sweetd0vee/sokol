import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User } from 'lucide-react';
import { Input } from '../ui/Input';
import { DatePicker } from '../ui/DatePicker';
import { PageHeader } from '../ui/PageHeader';
import { fetchAnalyticsByPerson } from '../../api/analytics';
import { useCurrentUserName } from '../../hooks/useCurrentUserName';
import { toIsoDate } from '../../utils/dates';
import { EmptyState, LoadingState } from '../ui/StateMessage';

export function AnalyticsTab() {
  const currentUserName = useCurrentUserName();
  const [person, setPerson] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showOnlyMe, setShowOnlyMe] = useState(false);

  const personFilter = showOnlyMe ? currentUserName : person;
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-by-person', toIsoDate(startDate), toIsoDate(endDate), showOnlyMe, personFilter],
    queryFn: () =>
      fetchAnalyticsByPerson({
        start_date: toIsoDate(startDate),
        end_date: toIsoDate(endDate),
        person: personFilter || undefined,
      }),
    enabled: !(showOnlyMe && !currentUserName),
    retry: false,
  });

  const rows = showOnlyMe && !currentUserName ? [] : (data?.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader title="Аналитика" />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-slate-700 dark:bg-slate-800">
        <Input
          label="Сотрудник (для поиска)"
          value={person}
          onChange={setPerson}
          placeholder="ФИО для фильтра"
          className="min-w-[200px]"
          readOnly={showOnlyMe}
        />
        <DatePicker label="Период с" selected={startDate} onChange={setStartDate} />
        <DatePicker label="Период по" selected={endDate} onChange={setEndDate} />
        <button
          type="button"
          onClick={() => setShowOnlyMe((value) => !value)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors ${
            showOnlyMe
              ? 'bg-sber-dark text-white'
              : 'border-2 border-sber-dark bg-white text-sber-dark hover:bg-sber-dark/5 dark:border-sber-light dark:bg-slate-800 dark:text-sber-light dark:hover:bg-sber-light/10'
          }`}
        >
          <User size={18} />
          Обо мне
        </button>
      </div>

      {showOnlyMe && !currentUserName && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-300">
          Укажите ФИО в профиле, чтобы фильтровать данные по себе.
        </div>
      )}

      {isLoading && <LoadingState />}

      {!isLoading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-sber-dark text-white">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Сотрудник</th>
                <th className="px-4 py-3 text-left font-medium">Рекомендаций</th>
                <th className="px-4 py-3 text-left font-medium">Проверок</th>
                <th className="px-4 py-3 text-left font-medium">Проверок с красным уровнем</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState
                      className="rounded-none border-0"
                      title="Нет данных за выбранный период"
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.person} className="hover:bg-gray-50 dark:hover:bg-slate-800/70">
                    <td className="px-4 py-3 font-medium">{row.person}</td>
                    <td className="px-4 py-3">{row.recommendations_count}</td>
                    <td className="px-4 py-3">{row.checks_count}</td>
                    <td className="px-4 py-3">
                      <span className={row.checks_red_level_count > 0 ? 'font-medium text-red-600' : ''}>
                        {row.checks_red_level_count}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
