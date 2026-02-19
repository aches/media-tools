import React from 'react'
import { cn } from '../../lib/utils'

export function Button({ className, variant = 'default', size = 'md', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-slate-200 bg-white hover:bg-slate-50',
    ghost: 'hover:bg-slate-100'
  }
  const sizes = {
    sm: 'h-8 px-3',
    md: 'h-9 px-4',
    lg: 'h-10 px-6'
  }
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
}
