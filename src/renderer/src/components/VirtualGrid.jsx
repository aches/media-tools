import React, { useEffect, useMemo, useRef, useState } from 'react'
import PerfectScrollbar from 'perfect-scrollbar'
import 'perfect-scrollbar/css/perfect-scrollbar.css'

export default function VirtualGrid({ items, renderItem, minItemWidth = 180, itemHeight = 180, gap = 12, className = '' }) {
  const ref = useRef(null)
  const psRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setWidth(e.contentRect.width)
        setHeight(e.contentRect.height)
      }
    })
    ro.observe(el)
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', onScroll)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    psRef.current = new PerfectScrollbar(el, { suppressScrollX: true })
    return () => {
      psRef.current?.destroy()
      psRef.current = null
    }
  }, [])

  const calc = useMemo(() => {
    const columns = Math.max(1, Math.floor((width - gap) / (minItemWidth + gap)))
    const rowHeight = itemHeight + gap
    const totalRows = Math.ceil(items.length / columns)
    const overscan = 2
    const visibleRows = Math.ceil(height / rowHeight) + overscan
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const endRow = Math.min(totalRows - 1, startRow + visibleRows)
    const startIndex = startRow * columns
    const endIndex = Math.min(items.length - 1, (endRow + 1) * columns - 1)
    const topPad = startRow * rowHeight
    const bottomPad = Math.max(0, (totalRows - endRow - 1) * rowHeight)
    return { columns, startIndex, endIndex, topPad, bottomPad }
  }, [width, height, scrollTop, items.length, minItemWidth, itemHeight, gap])

  const visible = useMemo(() => items.slice(calc.startIndex, calc.endIndex + 1), [items, calc.startIndex, calc.endIndex])

  useEffect(() => {
    psRef.current?.update()
  }, [width, height, items.length, calc.startIndex, calc.endIndex, calc.columns])

  return (
    <div ref={ref} className={`ps h-full overflow-hidden relative ${className}`}>
      <div style={{ height: calc.topPad }} />
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${calc.columns}, minmax(0, 1fr))`, gap: `${gap}px` }}
      >
        {visible.map((item, i) => (
          <div key={calc.startIndex + i} style={{ minHeight: itemHeight }}>
            {renderItem(item)}
          </div>
        ))}
      </div>
      <div style={{ height: calc.bottomPad }} />
    </div>
  )
}
