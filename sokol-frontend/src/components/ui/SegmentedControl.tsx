type Option<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = '',
  buttonClassName = '',
}: SegmentedControlProps<T>) {
  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`inline-flex min-w-[156px] items-center justify-center rounded-lg px-2.5 py-1 text-sm font-medium transition ${
            value === option.value
              ? 'bg-sber-dark text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
          } ${buttonClassName}`.trim()}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
