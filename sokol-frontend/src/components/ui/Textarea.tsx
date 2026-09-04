import type { ChangeEvent, FocusEvent } from 'react';
import { cn } from '../../utils/classNames';

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
  const textareaClasses = cn(
    'min-h-[3rem] w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 ',
    readOnly ? 'bg-gray-100 text-gray-800 ' : undefined,
    inputClassName,
  );

  return (
    <div className={className}>
      {label && (
        <label
          className={cn('mb-1 block text-sm font-medium text-gray-700 ', labelClassName)}
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
