import React from 'react'
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
  )
}
