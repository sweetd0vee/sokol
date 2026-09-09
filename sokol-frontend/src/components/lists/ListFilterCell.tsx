import type { ReactNode } from 'react';
import { DatePicker } from '../ui/DatePicker';
import { listFilterClass, LIST_RESET_FILTERS_BUTTON_CLASS } from '../../constants/formLayout';

export function ListFilterCell({
  children,
  colSpan,
  alignEnd = false,
}: {
  children?: ReactNode;
  colSpan?: number;
  alignEnd?: boolean;
}) {
  return (
    <th colSpan={colSpan} className={alignEnd ? 'px-0 pr-4 py-2 font-normal' : 'px-2 py-2 font-normal'}>
      {children}
    </th>
  );
}

export function ListDateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: Date | null;
  to: Date | null;
  onFromChange: (value: Date | null) => void;
  onToChange: (value: Date | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <DatePicker
        selected={from}
        onChange={onFromChange}
        placeholder="с"
        inputClassName={listFilterClass(Boolean(from))}
      />
      <DatePicker
        selected={to}
        onChange={onToChange}
        placeholder="по"
        inputClassName={listFilterClass(Boolean(to))}
      />
    </div>
  );
}

export function ListResetFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={LIST_RESET_FILTERS_BUTTON_CLASS}>
      Сбросить фильтры
    </button>
  );
}
