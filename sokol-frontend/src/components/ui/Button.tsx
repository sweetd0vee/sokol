import type { ButtonHTMLAttributes } from 'react';

const VARIANT_CLASS = {
  primary:
    'bg-sber-dark text-white hover:bg-sber-muted disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'border border-sber-light text-sber-light hover:bg-sber-light hover:text-white dark:border-sber-light dark:text-sber-light',
  ghost:
    'border border-gray-200 text-gray-700 hover:border-sber-dark/40 hover:text-sber-dark dark:border-slate-600 dark:text-slate-200 dark:hover:border-sber-light/70 dark:hover:text-sber-light',
} as const;

type ButtonVariant = keyof typeof VARIANT_CLASS;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-6 py-2 text-sm font-medium transition';
  return (
    <button type={type} className={`${base} ${VARIANT_CLASS[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
