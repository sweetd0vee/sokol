import type { ReactNode } from 'react';

export function AnalyticsDashboardFrame({
  sidebar,
  children,
  mainClassName = 'flex min-h-0 min-w-0 flex-1 flex-col lg:-mt-[84px]',
}: {
  sidebar: ReactNode;
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-4 text-left lg:flex-row lg:items-stretch">
      {sidebar}
      <main className={mainClassName}>{children}</main>
    </div>
  );
}
