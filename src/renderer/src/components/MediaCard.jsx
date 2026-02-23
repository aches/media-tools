import React, { useEffect, useRef, useState } from 'react'
import LazyMedia from './LazyMedia.jsx'

export default function MediaCard({
  filePath,
  type,
  rootRef,
  thumbPath,
  onContextMenu,
  onOpenVideo,
  formatBytes,
  formatDuration,
  loadVideoMeta,
  startTitleScroll,
  stopTitleScroll
}) {
  const [info, setInfo] = useState({})
  const infoRef = useRef({})
  const pendingRef = useRef(false)
  const hoverRef = useRef(false)
  const hoverTimerRef = useRef(null)

  useEffect(() => {
    infoRef.current = info
  }, [info])

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
  }, [])

  const loadInfo = async () => {
    if (pendingRef.current) return
    pendingRef.current = true
    try {
      const cached = infoRef.current
      if (!cached.size && window.api?.getFileInfo) {
        const basic = await window.api.getFileInfo(filePath)
        if (basic?.size != null) {
          setInfo(prev => ({ ...prev, size: basic.size, name: basic.name }))
        }
      }
      if (type === 'video' && (!cached.duration || !cached.width || !cached.height) && loadVideoMeta) {
        const meta = await loadVideoMeta(filePath)
        if (meta) setInfo(prev => ({ ...prev, ...meta }))
      }
    } finally {
      pendingRef.current = false
    }
  }

  const handleMouseEnter = () => {
    hoverRef.current = true
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      if (hoverRef.current) loadInfo()
    }, 120)
  }

  const handleMouseLeave = () => {
    hoverRef.current = false
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
  }

  const name = info.name || filePath.split('/').pop()
  const pathText = filePath
  const sizeText = info.size != null ? formatBytes(info.size) : '读取中...'
  const resolutionText = info.width && info.height ? `${info.width}×${info.height}` : '读取中...'
  const durationText = type === 'video' ? (info.duration != null ? formatDuration(info.duration) : '读取中...') : null

  return (
    <div
      className="group relative border border-separator rounded-md p-2 bg-surface flex flex-col gap-2"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => { if (type === 'video') onOpenVideo?.(filePath) }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(filePath, e.clientX, e.clientY) }}
    >
      {type === 'video' ? (
        thumbPath ? (
          <LazyMedia
            src={`safe-file://${thumbPath}`}
            alt=""
            rootRef={rootRef}
            wrapperClassName="w-full h-32"
            imgClassName="w-full h-full object-cover rounded"
            placeholderClassName="w-full h-full rounded bg-muted"
          />
        ) : (
          <div className="w-full h-32 rounded bg-muted flex items-center justify-center text-xs text-muted">无封面</div>
        )
      ) : (
        <LazyMedia
          src={`safe-file://${filePath}`}
          alt=""
          rootRef={rootRef}
          wrapperClassName="w-full h-32"
          imgClassName="w-full h-full object-cover rounded"
          placeholderClassName="w-full h-full rounded bg-muted"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (naturalWidth && naturalHeight) {
              setInfo(prev => ({ ...prev, width: naturalWidth, height: naturalHeight }))
            }
          }}
        />
      )}
      <div className="absolute inset-0 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity px-2 py-2 text-xs flex flex-col gap-1">
        <div className="scroll-on-hover w-full font-medium" onMouseEnter={startTitleScroll} onMouseLeave={stopTitleScroll}>
          <span data-scroll-text className="scroll-on-hover__content">{name}</span>
        </div>
        <div className="scroll-on-hover w-full" onMouseEnter={startTitleScroll} onMouseLeave={stopTitleScroll}>
          <span data-scroll-text className="scroll-on-hover__content">{pathText}</span>
        </div>
        <div>大小 {sizeText}</div>
        <div>分辨率 {resolutionText}</div>
        {type === 'video' ? <div>时长 {durationText}</div> : null}
      </div>
      <div className="text-xs text-muted truncate">{name}</div>
    </div>
  )
}

