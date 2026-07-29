import type { ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { getErrorMessage } from '../../api/errors';
import { EmptyState, ErrorState, LoadingState } from '../ui/StateMessage';

export type TableRow = {
  key: string;
  cells: ReactNode[];
};

type SettingsTableCardProps = {
  title: string;
  columns: string[];
  rows: TableRow[];
  isLoading: boolean;
  error: unknown;
  onAdd?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export function SettingsTableCard({
  title,
  columns,
  rows,
  isLoading,
  error,
  onAdd,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Поиск',
}: SettingsTableCardProps) {
  const showSearch = Boolean(onSearchChange);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-gray-200 px-4 py-3 text-base font-semibold text-gray-900 dark:border-slate-700 dark:text-slate-100">
        <div className="flex items-center justify-start">
          {showSearch && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <Search size={16} className="text-gray-400 dark:text-slate-400" />
              <input
                type="text"
                value={searchValue ?? ''}
                onChange={(event) => onSearchChange?.(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-36 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
              />
            </div>
          )}
        </div>
        <div className="text-center">{title}</div>
        <div className="flex items-center justify-end">
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Добавить: ${title}`}
              title="Добавить"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sber-dark text-sber-dark transition hover:border-sber-muted hover:bg-sber-muted hover:text-white dark:border-sber-light dark:text-sber-light"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="h-[724px] overflow-y-scroll">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-sber-dark text-white">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 text-left font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-slate-800/70">
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}-${index}`} className="px-4 py-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : isLoading ? (
        <LoadingState className="py-10" />
      ) : error ? (
        <div className="p-4">
          <ErrorState description={getErrorMessage(error, 'Убедитесь, что бэкенд запущен.')} />
        </div>
      ) : (
        <EmptyState className="rounded-none border-0" />
      )}
    </div>
  );
}
