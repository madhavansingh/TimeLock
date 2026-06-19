import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'info', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold',
            {
              'bg-emerald-100 text-emerald-800': variant === 'success',
              'bg-amber-100 text-amber-800': variant === 'warning',
              'bg-rose-100 text-rose-800': variant === 'danger',
              'bg-blue-100 text-blue-800': variant === 'info',
            },
            className
          )
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
