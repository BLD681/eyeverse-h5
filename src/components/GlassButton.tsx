import type { ButtonHTMLAttributes } from 'react';

export function GlassButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`glass-button ${className}`} {...props}>{children}<span aria-hidden="true">↗</span></button>;
}
