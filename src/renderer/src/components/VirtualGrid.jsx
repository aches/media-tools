import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AutoSizer, Grid } from 'react-virtualized'
import 'react-virtualized/styles.css'

function rectFromPoints(x1, y1, x2, y2) {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  }
}

function intersects(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
}

export default function VirtualGrid({
  items,
  renderItem,
  minItemWidth = 180,
  itemHeight = 180,
  gap = 12,
  className = '',
  getItemKey = (item) => item,
  selectedKeys = new Set(),
  onSelectionChange,
  enableDragSelect = false
}) {
  const containerRef = useRef(null)
  const dragStateRef = useRef(null)
  const suppressClickRef = useRef(false)
  const [selectionBox, setSelectionBox] = useState(null)

  const selectedSet = useMemo(
    () => (selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || [])),
    [selectedKeys]
  )

  useEffect(() => () => {
    const current = dragStateRef.current
    if (!current) return
    clearTimeout(current.timerId)
    document.removeEventListener('mousemove', current.onMouseMove)
    document.removeEventListener('mouseup', current.onMouseUp)
  }, [])

  const collectIntersectedKeys = (rect) => {
    const root = containerRef.current
    if (!root || !onSelectionChange) return
    const nodes = root.querySelectorAll('[data-media-item-key]')
    const selected = []
    nodes.forEach((node) => {
      const key = node.getAttribute('data-media-item-key')
      if (!key) return
      const r = node.getBoundingClientRect()
      if (intersects(rect, r)) selected.push(key)
    })
    onSelectionChange(selected)
  }

  const handleMouseDown = (event) => {
    if (!enableDragSelect || event.button !== 0) return
    const root = containerRef.current
    if (!root || !root.contains(event.target)) return
    if (event.target.closest('button, input, textarea, a, [role="button"], [data-disable-drag-select="1"]')) return

    const state = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      active: false,
      timerId: null,
      onMouseMove: null,
      onMouseUp: null
    }
    dragStateRef.current = state

    const activateSelection = () => {
      const current = dragStateRef.current
      if (!current) return
      current.active = true
      const rect = rectFromPoints(current.startX, current.startY, current.lastX, current.lastY)
      setSelectionBox(rect)
      collectIntersectedKeys({
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height
      })
    }

    state.timerId = setTimeout(activateSelection, 180)

    state.onMouseMove = (e) => {
      const current = dragStateRef.current
      if (!current) return
      current.lastX = e.clientX
      current.lastY = e.clientY
      if (!current.active) return
      const rect = rectFromPoints(current.startX, current.startY, current.lastX, current.lastY)
      setSelectionBox(rect)
      collectIntersectedKeys({
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height
      })
    }

    state.onMouseUp = () => {
      const current = dragStateRef.current
      if (!current) return
      clearTimeout(current.timerId)
      document.removeEventListener('mousemove', current.onMouseMove)
      document.removeEventListener('mouseup', current.onMouseUp)
      const wasActive = current.active
      dragStateRef.current = null
      setSelectionBox(null)
      if (wasActive) {
        suppressClickRef.current = true
        setTimeout(() => { suppressClickRef.current = false }, 0)
      }
    }

    document.addEventListener('mousemove', state.onMouseMove)
    document.addEventListener('mouseup', state.onMouseUp)
  }

  const handleClickCapture = (event) => {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full overflow-y-auto overflow-x-hidden ${className}`}
      onMouseDown={handleMouseDown}
      onClickCapture={handleClickCapture}
    >
      <AutoSizer>
        {({ width, height }) => {
          const columnCount = Math.max(1, Math.floor((width - gap) / (minItemWidth + gap)))
          const rowCount = Math.ceil(items.length / columnCount)
          const columnWidth = Math.max(0, Math.floor((width - gap * (columnCount + 1)) / columnCount))
          const rowHeight = itemHeight + gap
          const gridKey = `${width}-${height}-${columnCount}-${rowCount}-${columnWidth}-${rowHeight}`

          const cellRenderer = ({ columnIndex, rowIndex, key, style }) => {
            const index = rowIndex * columnCount + columnIndex
            if (index >= items.length) return null
            const item = items[index]
            const itemKey = String(getItemKey(item))
            const cellStyle = {
              ...style,
              left: style.left + gap,
              top: style.top + gap,
              width: Math.max(0, style.width - gap),
              height: Math.max(0, style.height - gap)
            }
            return (
              <div key={key} style={cellStyle} data-media-item-key={itemKey}>
                {renderItem(item, { rootRef: containerRef, isSelected: selectedSet.has(itemKey) })}
              </div>
            )
          }

          return (
            <Grid
              key={gridKey}
              width={width}
              height={height}
              columnCount={columnCount}
              columnWidth={columnWidth + gap}
              rowCount={rowCount}
              rowHeight={rowHeight}
              cellRenderer={cellRenderer}
              overscanRowCount={2}
              overscanColumnCount={1}
              style={{ overflowX: 'hidden' }}
              containerStyle={{ overflowX: 'hidden' }}
            />
          )
        }}
      </AutoSizer>
      {selectionBox ? (
        <div
          className="pointer-events-none fixed z-[1200] border border-primary bg-primary/15"
          style={{
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height
          }}
        />
      ) : null}
    </div>
  )
}
