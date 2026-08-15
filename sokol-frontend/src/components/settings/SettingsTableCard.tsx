import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { getErrorMessage } from '../../api/errors';
import { Input } from '../ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../ui/StateMessage';

const SETTINGS_ADD_BUTTON_CLASS =
  'inline-flex w-[140px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#90EE90] px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-[#7fdc7f] ';

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
  const actionColumnIndex = columns.findIndex((column) => column === 'Действия');

  return (
    <div className="w-full max-w-7xl overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-base min-w-[640px]">
          <colgroup>
            {columns.map((column, index) => (
              <col
                key={column}
                className={
                  index === actionColumnIndex
                    ? 'w-[300px]'
                    : column === '№'
                      ? 'w-16'
                      : column === 'Код'
                        ? 'w-[180px]'
                        : undefined
                }
              />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th colSpan={columns.length} className="px-2 py-2 font-normal">
                {showSearch && (
                  <Input
                    value={searchValue ?? ''}
                    onChange={(value) => onSearchChange?.(value)}
                    placeholder={searchPlaceholder}
                    inputClassName="py-1.5 text-sm"
                  />
                )}
              </th>
            </tr>
            <tr className="bg-[#003366] text-white">
              {columns.map((column, index) => (
                <th
                  key={column}
                  className={index === actionColumnIndex ? 'px-0 py-3 text-center font-medium' : 'px-4 py-3 text-left font-medium'}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-gray-50">
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-${index}`} className={index === actionColumnIndex ? 'px-0 py-3' : 'px-4 py-3'}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && isLoading ? (
        <LoadingState className="py-10" />
      ) : rows.length === 0 && error ? (
        <div className="p-4">
          <ErrorState description={getErrorMessage(error, 'Убедитесь, что бэкенд запущен.')} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState className="rounded-none border-0" />
      ) : null}
      {onAdd && (
        <div className="flex justify-start border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Добавить: ${title}`}
            className={SETTINGS_ADD_BUTTON_CLASS}
          >
            <Plus size={14} />
            Добавить
          </button>
        </div>
      )}
    </div>
  );
}
