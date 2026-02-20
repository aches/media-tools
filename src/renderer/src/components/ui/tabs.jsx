import React from 'react'
<<<<<<< HEAD
import { Tabs as HTabs } from '@heroui/react'

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <HTabs
      className={className}
      selectedKey={active}
      onSelectionChange={key => onChange?.(String(key))}
    >
      <HTabs.ListContainer>
        <HTabs.List aria-label="选项卡">
          {tabs?.map(t => (
            <HTabs.Tab key={t.value} id={t.value}>
              {t.label}
              <HTabs.Indicator />
            </HTabs.Tab>
          ))}
        </HTabs.List>
      </HTabs.ListContainer>
    </HTabs>
=======
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
>>>>>>> 3c2efc4150028cbd5b24dcb12e024524474e68b9
  )
}
