'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  disabled?: boolean;
  id?: string;
}

export function Select({
  label,
  placeholder = 'Sélectionner…',
  value,
  onValueChange,
  options,
  error,
  disabled,
  id,
}: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-st-sec font-sans">
          {label}
        </label>
      )}
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={cn(
            'flex items-center justify-between w-full',
            'bg-st-card border border-st-border rounded-md',
            'px-3.5 py-[11px] text-sm font-sans text-left',
            'outline-none transition-colors duration-150',
            'focus:border-st-indigo focus:ring-1 focus:ring-st-indigo/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'data-[placeholder]:text-st-dim',
            error && 'border-st-danger',
            value ? 'text-st-hi' : 'text-st-dim',
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown size={14} className="text-st-dim" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            className={cn(
              'z-50 min-w-[var(--radix-select-trigger-width)]',
              'bg-st-card border border-st-border rounded-md',
              'shadow-md overflow-hidden',
              'animate-in fade-in-0 zoom-in-95',
            )}
            position="popper"
            sideOffset={4}
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className={cn(
                    'flex items-center justify-between',
                    'px-3 py-2 text-sm text-st-sec font-sans rounded-sm',
                    'cursor-pointer outline-none',
                    'hover:bg-st-raised hover:text-st-hi',
                    'data-[state=checked]:text-st-hi',
                    'data-[highlighted]:bg-st-raised data-[highlighted]:text-st-hi',
                  )}
                >
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check size={12} className="text-st-indigo-glow" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && (
        <p id={errorId} className="text-[11.5px] text-st-danger font-sans" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
