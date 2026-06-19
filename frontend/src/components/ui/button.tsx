import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none',
            {
              'bg-blue-900 text-white hover:bg-blue-950': variant === 'primary',
              'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50': variant === 'secondary',
              'bg-red-600 text-white hover:bg-red-750': variant === 'danger',
              'text-slate-650 hover:bg-slate-100': variant === 'ghost',
              'px-3 py-1.5 text-xs': size === 'sm',
              'px-4 py-2.5 text-sm': size === 'md',
              'px-6 py-3 text-base': size === 'lg',
            },
            className
          )
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
