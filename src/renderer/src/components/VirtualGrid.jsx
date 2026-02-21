import React, { useMemo, useRef } from 'react'
import { AutoSizer, Grid } from 'react-virtualized'
import 'react-virtualized/styles.css'

export default function VirtualGrid({ items, renderItem, minItemWidth = 180, itemHeight = 180, gap = 12, className = '' }) {
  const containerRef = useRef(null)

  return (
    <div ref={containerRef} className={`h-full overflow-hidden ${className}`}>
      <AutoSizer>
        {({ width, height }) => {
          const columnCount = Math.max(1, Math.floor((width - gap) / (minItemWidth + gap)))
          const rowCount = Math.ceil(items.length / columnCount)
          const columnWidth = Math.max(0, Math.floor((width - gap * (columnCount + 1)) / columnCount))
          const rowHeight = itemHeight + gap

          const cellRenderer = ({ columnIndex, rowIndex, key, style }) => {
            const index = rowIndex * columnCount + columnIndex
            if (index >= items.length) return null
            const item = items[index]
            const cellStyle = {
              ...style,
              left: style.left + gap,
              top: style.top + gap,
              width: Math.max(0, style.width - gap),
              height: Math.max(0, style.height - gap)
            }
            return (
              <div key={key} style={cellStyle}>
                {renderItem(item, { rootRef: containerRef })}
              </div>
            )
          }

          return (
            <Grid
              width={width}
              height={height}
              columnCount={columnCount}
              columnWidth={columnWidth + gap}
              rowCount={rowCount}
              rowHeight={rowHeight}
              cellRenderer={cellRenderer}
              overscanRowCount={2}
              overscanColumnCount={1}
            />
          )
        }}
      </AutoSizer>
    </div>
  )
}
