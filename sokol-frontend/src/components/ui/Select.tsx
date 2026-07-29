import type { ChangeEvent } from 'react';

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = '',
  inputClassName = '',
  labelClassName = '',
}: SelectProps) {
  return (
    <div className={className}>
      {label && (
        <label
          className={[
            'mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300',
            labelClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className={[
          'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sber-light dark:focus:ring-sber-light/25',
          inputClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
