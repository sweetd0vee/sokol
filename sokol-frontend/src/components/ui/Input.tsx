import { useId, type ChangeEvent, type FocusEvent, type ReactNode } from 'react';
import { cn } from '../../utils/classNames';

interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  type?: 'text' | 'number' | 'email' | 'password';
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  rightElement?: ReactNode;
  readOnly?: boolean;
  autoComplete?: string;
}

export function Input({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  className = '',
  inputClassName = '',
  labelClassName = '',
  rightElement,
  readOnly = false,
  autoComplete,
}: InputProps) {
  const inputId = useId();
  const inputClasses = cn(
    'w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 ',
    rightElement ? 'pr-10' : undefined,
    inputClassName,
  );

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className={cn('mb-1 block text-sm font-medium text-gray-700 ', labelClassName)}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          readOnly={readOnly}
          autoComplete={autoComplete}
          size={1}
          className={inputClasses}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-2 flex items-center">{rightElement}</div>
        )}
      </div>
    </div>
  );
}
