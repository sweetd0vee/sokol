import type { ReactNode } from 'react';

export function ChartCard({
  title,
  description,
  children,
  className = '',
  accentClassName = 'border-gray-200 dark:border-slate-700',
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  accentClassName?: string;
}) {
  return (
    <section
      className={`rounded-xl border bg-white p-3.5 dark:bg-slate-800 ${accentClassName} ${className}`}
    >
      <div className="mb-3 space-y-0.5">
        <h3 className="text-sm font-semibold text-sber-dark dark:text-sber-light">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  suffix,
  tone = 'blue',
}: {
  label: string;
  value: number;
  hint?: string;
  suffix?: string;
  tone?: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100',
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100',
    red: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100',
    amber:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100',
    violet:
      'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100',
    slate:
      'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
  };

  return (
    <div className={`rounded-xl border px-3.5 py-2.5 ${tones[tone]}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">
        {value}
        {suffix ? <span className="ml-0.5 text-sm font-medium">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] opacity-70">{hint}</p> : null}
    </div>
  );
}

export function EmptyChart({ message, heightClass = 'h-52' }: { message: string; heightClass?: string }) {
  return (
    <div
      className={`flex ${heightClass} items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400`}
    >
      {message}
    </div>
  );
}

export const PALETTE = [
  '#003366',
  '#2563EB',
  '#6699FF',
  '#22C55E',
  '#EAB308',
  '#EF4444',
  '#A855F7',
  '#06B6D4',
  '#F97316',
  '#EC4899',
  '#14B8A6',
  '#8B5CF6',
];
