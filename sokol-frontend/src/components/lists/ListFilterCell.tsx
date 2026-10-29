import type { ReactNode } from 'react';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
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

export function ListTextFilterCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <ListFilterCell>
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputClassName={listFilterClass(Boolean(value.trim()))}
      />
    </ListFilterCell>
  );
}

export function ListDateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  className = '',
}: {
  from: Date | null;
  to: Date | null;
  onFromChange: (value: Date | null) => void;
  onToChange: (value: Date | null) => void;
  className?: string;
}) {
  return (
    <div className={['flex min-w-0 flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      <DatePicker
        selected={from}
        onChange={onFromChange}
        placeholder="с"
        inputClassName={`${listFilterClass(Boolean(from))} !px-2`}
      />
      <DatePicker
        selected={to}
        onChange={onToChange}
        placeholder="по"
        inputClassName={`${listFilterClass(Boolean(to))} !px-2`}
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
