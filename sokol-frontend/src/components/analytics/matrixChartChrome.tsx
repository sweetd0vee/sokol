import type { HTMLAttributes, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortDirection } from '../../utils/listTable';

export function MatrixCountSortHeader({
  label,
  active,
  direction,
  onClick,
  align = 'center',
  className = '',
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const sortLabel = !active
    ? `Сортировать по убыванию: ${label}`
    : direction === 'desc'
      ? `Сортировать по возрастанию: ${label}`
      : `Сбросить сортировку: ${label}`;
  const alignClass =
    align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  const justifyClass =
    align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  const paddingClass = align === 'center' ? 'px-1' : 'px-3';

  return (
    <th
      className={`${paddingClass} py-2 font-semibold text-sber-dark ${alignClass} ${className}`}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex w-full items-center gap-1 text-sber-dark transition hover:text-sber ${justifyClass}`}
        title={sortLabel}
        aria-label={sortLabel}
      >
        <span className="text-balance leading-tight">{label}</span>
        {active ? (
          direction === 'asc' ? (
            <ArrowUp size={14} aria-hidden />
          ) : (
            <ArrowDown size={14} aria-hidden />
          )
        ) : (
          <ChevronsUpDown size={14} className="text-gray-400" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function MatrixChartShell({
  children,
  hoveredRow,
  footer,
  scrollBody = true,
}: {
  children: ReactNode;
  hoveredRow: { key: string; name: string } | null;
  footer: ReactNode;
  scrollBody?: boolean;
}) {
  return (
    <div
      data-export-html
      className={
        scrollBody
          ? 'flex h-full min-h-[13rem] flex-col gap-2'
          : 'flex min-h-[13rem] flex-col gap-2'
      }
    >
      <div
        className={
          scrollBody
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-100'
            : 'rounded-lg border border-gray-100'
        }
      >
        <div className={scrollBody ? 'min-h-0 flex-1 overflow-auto' : undefined}>{children}</div>
      </div>

      {hoveredRow ? (
        <p className="shrink-0 truncate text-xs text-gray-600" title={hoveredRow.name}>
          <span className="font-semibold text-sber-dark">{hoveredRow.key}</span>
          {': '}
          {hoveredRow.name}
        </p>
      ) : null}

      {footer}
    </div>
  );
}

export function MatrixLegendFooter({
  totalText,
  totalProps,
  legend,
  legendListProps,
  swatchClassName = 'inline-block h-3 w-3 rounded-sm border border-black/10',
}: {
  totalText: ReactNode;
  totalProps?: HTMLAttributes<HTMLParagraphElement> & Record<string, unknown>;
  legend: Array<{ key: string; label: string; color: string }>;
  legendListProps?: HTMLAttributes<HTMLUListElement> & Record<string, unknown>;
  swatchClassName?: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
      <p className="text-base font-medium text-gray-700" {...totalProps}>
        <span className="font-semibold text-sber-dark">Итого:</span>{' '}
        {totalText}
      </p>
      <ul
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-base text-black"
        {...legendListProps}
      >
        {legend.map((item) => (
          <li key={item.key} className="inline-flex items-center gap-1.5">
            <span
              className={swatchClassName}
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
