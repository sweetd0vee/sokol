import {
  MATERIALITY_LEVEL_OPTIONS,
  type ColoredSelectOption,
} from '../../constants/recommendations';

type MaterialitySelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options?: ColoredSelectOption[];
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
};

export function MaterialitySelect({
  label,
  value,
  onChange,
  options = MATERIALITY_LEVEL_OPTIONS,
  className = '',
  labelClassName = '',
  inputClassName = '',
}: MaterialitySelectProps) {
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
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={[
            'w-full appearance-none rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-gray-900 outline-none transition focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sber-light dark:focus:ring-sber-light/25',
            inputClassName || 'py-2',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          className={[
            'pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full',
            options.find((option) => option.value === value)?.dotClassName ?? 'bg-gray-300',
          ].join(' ')}
        />
      </div>
    </div>
  );
}
