import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  INDICATOR_OPTIONS,
  type ColoredSelectOption,
} from '../../constants/recommendations';
import {
  INDICATOR_ICONS,
  type IndicatorIconKey,
  type IndicatorIconMeta,
} from './indicatorIcons';
import { IndicatorGlyph } from './IndicatorGlyph';

type IndicatorSelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options?: ColoredSelectOption[];
  icons?: Partial<Record<IndicatorIconKey, IndicatorIconMeta>>;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
};

export function IndicatorSelect({
  label,
  value,
  onChange,
  options = INDICATOR_OPTIONS,
  icons = INDICATOR_ICONS,
  className = '',
  labelClassName = '',
  inputClassName = '',
}: IndicatorSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];
  const selectedMeta = icons[value as IndicatorIconKey];

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={className} ref={rootRef}>
      {label && (
        <label
          className={['mb-1 block text-sm font-medium text-gray-700 ', labelClassName]
            .filter(Boolean)
            .join(' ')}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
          className={[
            'flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-gray-900 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-300/40 ',
            inputClassName || 'py-2',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span
            className={[
              'flex h-4 w-4 shrink-0 items-center justify-center',
              selectedMeta?.className ?? 'text-gray-400 ',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <IndicatorGlyph meta={selectedMeta} size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? 'Не указан'}</span>
          <ChevronDown size={16} className="shrink-0 text-gray-400" />
        </button>

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {options.map((option) => {
              const meta = icons[option.value as IndicatorIconKey];
              const isActive = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    className={[
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 transition hover:bg-gray-50 ',
                      isActive ? 'bg-gray-50 font-medium ' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span
                      className={[
                        'flex h-4 w-4 shrink-0 items-center justify-center',
                        meta?.className ?? 'text-gray-400 ',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <IndicatorGlyph meta={meta} size={16} />
                    </span>
                    <span>{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
