import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-st-indigo text-white hover:bg-st-indigo-dim shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(0,0,0,.3)] disabled:opacity-60',
  ghost: 'bg-transparent text-st-hi border border-st-stroke hover:bg-st-raised',
  danger: 'bg-st-danger text-white hover:opacity-90 disabled:opacity-60',
  outline: 'bg-transparent text-st-indigo-glow border border-st-indigo/40 hover:bg-st-indigo/10',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-sm gap-1.5',
  md: 'px-[18px] py-[11px] text-[13.5px] rounded-md gap-2',
  lg: 'px-5 py-3 text-sm rounded-md gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium font-sans',
        'transition-all duration-150 whitespace-nowrap cursor-pointer',
        'disabled:cursor-not-allowed focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-st-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-st-bg',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <svg
          className="animate-spin -ml-0.5"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
