import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface DatePickerProps {
  label?: string;
  selected: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
  fieldClassName?: string;
  inputClassName?: string;
  labelClassName?: string;
  minDate?: Date | null;
  maxDate?: Date | null;
}

export function DatePicker({
  label,
  selected,
  onChange,
  placeholder = 'Выберите дату',
  className = '',
  fieldClassName = 'w-full',
  inputClassName = '',
  labelClassName = '',
  minDate,
  maxDate,
}: DatePickerProps) {
  return (
    <div className={className}>
      {label && (
        <label
          className={[
            'mb-1 block text-sm font-medium text-gray-700 ',
            labelClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {label}
        </label>
      )}
      <div className={fieldClassName}>
        <ReactDatePicker
          selected={selected}
          onChange={onChange}
          dateFormat="dd.MM.yyyy"
          placeholderText={placeholder}
          minDate={minDate ?? undefined}
          maxDate={maxDate ?? undefined}
          wrapperClassName="w-full min-w-0"
          className={[
            'w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 ',
            inputClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>
    </div>
  );
}
