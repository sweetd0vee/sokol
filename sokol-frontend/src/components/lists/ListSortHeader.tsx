import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortDirection } from '../../utils/listTable';
import { LIST_TABLE_COLUMN_HEADER_ROW_CLASS } from '../../constants/formLayout';

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

export function ListColumnHeaderCell({
  children,
  className = '',
  align = 'left',
}: {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center';
}) {
  const innerAlignClass =
    align === 'center' ? `justify-center px-0 ${className}` : `px-4 ${className}`;

  return (
    <th className={`p-0 font-medium ${align === 'center' ? 'text-center' : 'text-left'}`}>
      <div className={`flex ${LIST_TABLE_COLUMN_HEADER_ROW_CLASS} shrink-0 items-center overflow-hidden ${innerAlignClass}`}>
        {children}
      </div>
    </th>
  );
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
    <ListColumnHeaderCell className={className} align={align}>
      <button type="button" onClick={onClick} className={alignedButtonClass}>
        <span className="leading-tight">{label}</span>
        <ListSortIcon active={active} direction={direction} />
      </button>
    </ListColumnHeaderCell>
  );
}
