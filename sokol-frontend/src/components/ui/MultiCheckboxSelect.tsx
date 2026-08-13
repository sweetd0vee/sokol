import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type MultiCheckboxOption = {
  value: string;
  label: string;
  dotClassName?: string;
};

type MultiCheckboxSelectProps = {
  label?: string;
  options: MultiCheckboxOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  emptyMessage?: string;
  defaultOpen?: boolean;
};

export function MultiCheckboxSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Все периоды',
  hint,
  className = '',
  inputClassName = '',
  labelClassName = '',
  emptyMessage = 'Нет доступных периодов',
  defaultOpen = false,
}: MultiCheckboxSelectProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedSet = useMemo(() => new Set(value), [value]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearchQuery('');
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!rootRef.current?.contains(target)) {
        closeDropdown();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDropdown, open]);

  const toggleOpen = () => {
    setOpen((prev) => {
      if (prev) {
        setSearchQuery('');
      }
      return !prev;
    });
  };

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const toggle = (optionValue: string) => {
    if (selectedSet.has(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }
    onChange([...value, optionValue]);
  };

  const selectAll = () => {
    onChange(options.map((option) => option.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const triggerLabel =
    value.length === 0 || options.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((option) => option.value === value[0])?.label ?? value[0]
        : `Выбрано: ${value.length}`;

  return (
    <div className={`relative ${className}`.trim()} ref={rootRef} data-multi-checkbox-select>
      {label ? (
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
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggleOpen}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-900 outline-none transition hover:border-gray-400 focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20 ',
          inputClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span
          className={`truncate ${
            value.length === 0 ? 'text-gray-500 ' : 'text-gray-900 '
          }`}
        >
          {triggerLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full max-w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="sticky top-0 space-y-1.5 border-b border-gray-100 bg-white px-2 py-1.5">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск"
              className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-sber-dark focus:ring-2 focus:ring-sber-dark/20"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                disabled={options.length === 0}
                className="rounded px-2 py-1 text-xs font-medium text-sber-dark hover:bg-sber-dark/5 disabled:opacity-40"
              >
                Все
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={value.length === 0}
                className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                Сбросить
              </button>
            </div>
          </div>
          {options.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-500">{emptyMessage}</p>
          ) : filteredOptions.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-500">Ничего не найдено</p>
          ) : (
            <ul className="py-1">
              {filteredOptions.map((option) => {
                const checked = selectedSet.has(option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(option.value)}
                      className="flex w-full min-w-0 items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-800 transition hover:bg-gray-50"
                    >
                      <span
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? 'border-sber-dark bg-sber-dark text-white'
                            : 'border-gray-300 bg-white '
                        }`}
                      >
                        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      {option.dotClassName ? (
                        <span
                          className={`h-3 w-3 shrink-0 rounded-full border border-gray-200 ${option.dotClassName}`}
                        />
                      ) : null}
                      <span className="min-w-0 truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
