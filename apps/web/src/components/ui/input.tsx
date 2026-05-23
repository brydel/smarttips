import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightSlot?: ReactNode;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, rightSlot, leftIcon, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="text-xs font-medium text-st-sec font-sans">
              {label}
            </label>
            {rightSlot}
          </div>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-st-dim pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-st-card border border-st-border rounded-md',
              'px-3.5 py-[11px] text-sm text-st-hi font-sans',
              'placeholder:text-st-dim outline-none',
              'transition-colors duration-150',
              'focus:border-st-indigo focus:ring-1 focus:ring-st-indigo/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-st-danger focus:border-st-danger focus:ring-st-danger/30',
              leftIcon && 'pl-9',
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...rest}
          />
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-[11.5px] text-st-danger font-sans"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-[11.5px] text-st-sec font-sans">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
