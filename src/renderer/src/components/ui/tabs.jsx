import React from 'react'
import { cn } from '../../lib/utils'

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={cn('flex items-center gap-2 border-b border-slate-200 px-4', className)}>
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'h-9 px-4 rounded-md',
            active === t.value ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
