import type { ReactNode } from 'react';

export function ListTableShell({
  className = 'rounded-xl border border-gray-200 bg-white',
  children,
  empty,
  footer,
}: {
  className?: string;
  children: ReactNode;
  empty?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        {children}
        {empty}
      </div>
      {footer}
    </div>
  );
}

export function ListTableFooter({
  children,
  pagination,
}: {
  children: ReactNode;
  pagination: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        {children}
      </div>
      {pagination}
    </div>
  );
}

export function ListFilterCount({ count }: { count: number }) {
  return <span className="whitespace-nowrap">Отработка фильтра: {count} записей</span>;
}

export function ListEmptyNotice({ children }: { children: ReactNode }) {
  return <div className="border-t border-gray-200 p-6">{children}</div>;
}
