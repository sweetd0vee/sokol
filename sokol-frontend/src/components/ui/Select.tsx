import type { ChangeEvent, CSSProperties } from 'react';
import { cn } from '../../utils/classNames';

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  inputStyle?: CSSProperties;
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
  inputStyle,
}: SelectProps) {
  return (
    <div className={className}>
      {label && (
        <label
          className={cn('mb-1 block text-sm font-medium text-gray-700 ', labelClassName)}
        >
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        style={inputStyle}
        className={cn(
          'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 ',
          inputClassName,
        )}
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
