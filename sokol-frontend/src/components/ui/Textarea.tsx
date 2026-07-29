import type { ChangeEvent, FocusEvent } from 'react';

interface TextareaProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  readOnly?: boolean;
  rows?: number;
  onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void;
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
  labelClassName = '',
  readOnly = false,
  rows = 3,
  onBlur,
}: TextareaProps) {
  const textareaClasses = [
    'min-h-[3rem] w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sber-light dark:focus:ring-sber-light/25',
    readOnly ? 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200' : '',
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ');

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
      <textarea
        value={value}
        onChange={
          onChange
            ? (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)
            : undefined
        }
        onBlur={onBlur}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={rows}
        className={textareaClasses}
      />
    </div>
  );
}
