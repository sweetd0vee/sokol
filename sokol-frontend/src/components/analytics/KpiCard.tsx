import type { ReactNode } from 'react';
import { kpiAccentStyle } from './analyticsPalette';

export function KpiCard({
  label,
  value,
  hint,
  suffix,
  tone = 'blue',
  accentColor,
}: {
  label: ReactNode;
  value: number;
  hint?: string;
  suffix?: string;
  tone?: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'slate' | 'lilac' | 'indigo' | 'fuchsia' | 'purple';
  /** Chart swatch hex; when set, overrides `tone` with a more transparent wash. */
  accentColor?: string;
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900 ',
    green:
      'border-emerald-200 bg-emerald-50 text-emerald-900 ',
    red: 'border-rose-200 bg-rose-50 text-rose-900 ',
    amber:
      'border-[#FBEB8D]/50 bg-[#FBEB8D]/25 text-slate-900 ',
    violet:
      'border-violet-200 bg-violet-50 text-violet-900 ',
    lilac:
      'border-purple-200 bg-purple-50 text-purple-900 ',
    indigo:
      'border-indigo-200 bg-indigo-50 text-indigo-900 ',
    fuchsia:
      'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 ',
    purple:
      'border-violet-300 bg-violet-100 text-violet-950 ',
    slate:
      'border-slate-200 bg-slate-50 text-slate-900 ',
  };

  return (
    <div
      className={`flex min-h-[5rem] items-center justify-between gap-2 rounded-lg border px-3 py-3.5 ${accentColor ? '' : tones[tone]}`}
      style={accentColor ? kpiAccentStyle(accentColor) : undefined}
    >
      <div className="min-w-0 pr-1">
        <p className="whitespace-pre-line text-sm leading-snug opacity-80">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-xs leading-none opacity-60">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-xl font-semibold leading-none">
        {value}
        {suffix ? <span className="ml-0.5 text-base font-medium">{suffix}</span> : null}
      </p>
    </div>
  );
}
