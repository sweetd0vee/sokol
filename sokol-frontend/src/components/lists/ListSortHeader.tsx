import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortDirection } from '../../utils/listTable';

type ListSortHeaderProps = {
  label: ReactNode;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
  buttonClassName?: string;
  align?: 'left' | 'center';
};

export function ListSortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) {
    return <ChevronsUpDown size={14} className="text-white/60" />;
  }
  return direction === 'asc'
    ? <ArrowUp size={14} className="text-white" />
    : <ArrowDown size={14} className="text-white" />;
}

export function ListSortHeader({
  label,
  active,
  direction,
  onClick,
  className = '',
  buttonClassName,
  align = 'left',
}: ListSortHeaderProps) {
  const alignedButtonClass =
    buttonClassName ??
    (align === 'center'
      ? 'inline-flex w-full items-center justify-center gap-1 text-white/90 transition hover:text-white'
      : 'inline-flex items-center gap-1 text-left text-white/90 transition hover:text-white');

  return (
    <th className={`${align === 'center' ? 'px-0 py-3 text-center font-medium' : `px-4 py-3 text-left font-medium ${className}`}`}>
      <button type="button" onClick={onClick} className={alignedButtonClass}>
        <span className="leading-tight">{label}</span>
        <ListSortIcon active={active} direction={direction} />
      </button>
    </th>
  );
}
