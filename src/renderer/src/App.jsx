import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, TagGroup, Tag, ListBox, Popover } from '@heroui/react'
import VirtualGrid from './components/VirtualGrid.jsx'
import MediaCard from './components/MediaCard.jsx'
import { toSafeFileUrl } from './lib/utils.js'

function getPathParts(filePath) {
  return String(filePath || '').split(/[\\/]/).filter(Boolean)
}

function getFolderName(filePath) {
  const parts = getPathParts(filePath)
  return parts.length > 1 ? parts[parts.length - 2] : ''
}

export default function App() {
  const [libraries, setLibraries] = useState([])
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [videoThumbnails, setVideoThumbnails] = useState({})
  const [tab, setTab] = useState('images')
  const [imagesFolder, setImagesFolder] = useState('all')
  const [videosFolder, setVideosFolder] = useState('all')
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [debugLogs, setDebugLogs] = useState([])
  const [showLogPanel, setShowLogPanel] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, file: null, targets: [] })
  const menuRef = useRef(null)

  const closeMenu = () => setMenu({ visible: false, x: 0, y: 0, file: null, targets: [] })

  useEffect(() => {
    window.api.getCache().then(cache => {
      setLibraries(cache.libraries || [])
      setImages(cache.images || [])
      setVideos(cache.videos || [])
      setVideoThumbnails(cache.videoThumbnails || {})
    })
    const offUpdate = window.api.onUpdateStatus(() => {})
    const offSync = window.api.onLibrarySync(s => {
      setLibraries(s.current.libraries || [])
      setImages(s.current.images || [])
      setVideos(s.current.videos || [])
      setVideoThumbnails(s.current.videoThumbnails || {})
    })
    window.api.getDebugLogs?.().then((logs) => {
      setDebugLogs(Array.isArray(logs) ? logs : [])
    }).catch(() => {})
    const offDebug = window.api.onDebugLog?.((entry) => {
      setDebugLogs((prev) => {
        const next = [...prev, entry]
        return next.length > 300 ? next.slice(next.length - 300) : next
      })
    })
    const offToggleLog = window.api.onToggleLogPanel?.(() => {
      setShowLogPanel((v) => !v)
    })
    return () => {
      offUpdate?.()
      offSync?.()
      offDebug?.()
      offToggleLog?.()
    }
  }, [])

  useEffect(() => {
    if (!menu.visible) return
    const onMouseDown = (e) => {
      if (e.button === 2) return
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) closeMenu()
    }
    const onScroll = () => closeMenu()
    const onResize = () => closeMenu()
    document.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [menu.visible])

  useEffect(() => {
    if (!previewImage) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])

  useEffect(() => {
    const existing = new Set([...images, ...videos])
    setSelectedFiles(prev => {
      if (!prev.size) return prev
      const next = new Set()
      prev.forEach((p) => {
        if (existing.has(p)) next.add(p)
      })
      return next.size === prev.size ? prev : next
    })
  }, [images, videos])

  const pickLibraries = async () => {
    const cache = await window.api.selectDirectories()
    setLibraries(cache.libraries || [])
    setImages(cache.images || [])
    setVideos(cache.videos || [])
    setVideoThumbnails(cache.videoThumbnails || {})
    setSelectedFiles(new Set())
  }

  const clearCache = async () => {
    const ok = window.confirm('确认清空缓存吗？将清空当前缓存列表与缩略图。')
    if (!ok) return
    const cache = await window.api.clearCache()
    setLibraries(cache.libraries || [])
    setImages(cache.images || [])
    setVideos(cache.videos || [])
    setVideoThumbnails(cache.videoThumbnails || {})
    setSelectedFiles(new Set())
    closeMenu()
  }

  const clearLibraryLinks = async () => {
    const ok = window.confirm('确认清空媒体库关联吗？不会删除磁盘中的任何文件。')
    if (!ok) return
    const cache = await window.api.clearLibraryLinks()
    setLibraries(cache.libraries || [])
    setImages(cache.images || [])
    setVideos(cache.videos || [])
    setVideoThumbnails(cache.videoThumbnails || {})
    setSelectedFiles(new Set())
    closeMenu()
  }

  const rescan = async () => {
    await window.api.rescanLibraries()
  }

  const startTitleScroll = (event) => {
    const wrapper = event.currentTarget
    const text = wrapper.querySelector('[data-scroll-text]')
    if (!text || text.scrollWidth <= wrapper.clientWidth) return
    wrapper._scrollDir = 1
    const step = () => {
      const max = wrapper.scrollWidth - wrapper.clientWidth
      if (max <= 0) return
      const next = wrapper.scrollLeft + wrapper._scrollDir
      if (next >= max || next <= 0) wrapper._scrollDir *= -1
      wrapper.scrollLeft = Math.min(max, Math.max(0, next))
      wrapper._scrollRaf = requestAnimationFrame(step)
    }
    wrapper._scrollRaf = requestAnimationFrame(step)
  }

  const stopTitleScroll = (event) => {
    const wrapper = event.currentTarget
    if (wrapper._scrollRaf) cancelAnimationFrame(wrapper._scrollRaf)
    wrapper._scrollRaf = null
    wrapper.scrollLeft = 0
  }

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return '未知'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    let v = bytes
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024
      i += 1
    }
    return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
  }

  const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds)) return '未知'
    const total = Math.round(seconds)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const pad = (n) => String(n).padStart(2, '0')
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
  }

  const loadVideoMeta = (filePath) => new Promise(resolve => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration })
      video.src = ''
    }
    video.onerror = () => resolve({})
    video.src = toSafeFileUrl(filePath)
  })

  const toggleSelected = (filePath) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }

  const handleCardContextMenu = (filePath, x, y) => {
    const useCurrentSelection = selectedFiles.has(filePath) && selectedFiles.size > 1
    const targets = useCurrentSelection ? Array.from(selectedFiles) : [filePath]
    if (!useCurrentSelection) setSelectedFiles(new Set([filePath]))
    setMenu({ visible: true, x, y, file: filePath, targets })
  }

  const deleteTargets = async (targets) => {
    const unique = Array.from(new Set((targets || []).filter(Boolean)))
    if (!unique.length) return
    const ok = window.confirm(`确定删除选中的 ${unique.length} 个文件？此操作不可恢复`)
    if (!ok) return
    if (unique.length === 1) {
      await window.api.deleteFile(unique[0])
    } else if (window.api.deleteFiles) {
      await window.api.deleteFiles(unique)
    } else {
      await Promise.all(unique.map((p) => window.api.deleteFile(p)))
    }
    setSelectedFiles(new Set())
    closeMenu()
  }

  const handleOpenImage = (filePath, e) => {
    if (e?.ctrlKey || e?.metaKey) {
      toggleSelected(filePath)
      return
    }
    setPreviewImage(filePath)
  }

  const handleOpenVideo = (filePath, e) => {
    if (e?.ctrlKey || e?.metaKey) {
      toggleSelected(filePath)
      return
    }
    window.api.openVideo(filePath)
  }

  const filteredImages = useMemo(
    () => images.filter(p => imagesFolder === 'all' || getFolderName(p) === imagesFolder),
    [images, imagesFolder]
  )

  const filteredVideos = useMemo(
    () => videos.filter(p => videosFolder === 'all' || getFolderName(p) === videosFolder),
    [videos, videosFolder]
  )

  const imageDirs = useMemo(() => {
    const set = new Set(images.map(getFolderName).filter(Boolean))
    return ['all', ...Array.from(set).sort()]
  }, [images])

  const videoDirs = useMemo(() => {
    const set = new Set(videos.map(getFolderName).filter(Boolean))
    return ['all', ...Array.from(set).sort()]
  }, [videos])

  const selectedCount = selectedFiles.size
  const formatLogTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleTimeString()
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <main className="flex-1 w-full overflow-hidden">
        <div className="grid grid-cols-[224px_1fr] grid-rows-[56px_1fr] h-full">
          <aside className="row-span-2 overflow-hidden">
            <div className="h-full hover-scroll overflow-x-hidden">
              <ListBox
                aria-label="文件夹"
                selectionMode="single"
                selectedKeys={new Set([tab === 'images' ? imagesFolder : videosFolder])}
                onSelectionChange={(keys) => {
                  const id = Array.from(keys || [])[0]
                  if (!id) return
                  if (tab === 'images') setImagesFolder(String(id))
                  else setVideosFolder(String(id))
                  setSelectedFiles(new Set())
                }}
                className="w-[224px] bg-transparent border-none p-2"
              >
                <ListBox.Item
                  id="all"
                  textValue="全部"
                  className="rounded-lg px-3 py-2 data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground data-[selected]:bg-primary/10 data-[selected]:text-foreground"
                >
                  <div className="scroll-on-hover w-full" onMouseEnter={startTitleScroll} onMouseLeave={stopTitleScroll}>
                    <span data-scroll-text className="scroll-on-hover__content">全部</span>
                  </div>
                </ListBox.Item>
                {(tab === 'images' ? imageDirs : videoDirs).filter(id => id !== 'all').map(id => (
                  <ListBox.Item
                    key={id}
                    id={id}
                    textValue={id}
                    className="rounded-lg px-3 py-2 data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground data-[selected]:bg-primary/10 data-[selected]:text-foreground"
                  >
                    <div className="scroll-on-hover w-full" onMouseEnter={startTitleScroll} onMouseLeave={stopTitleScroll}>
                      <span data-scroll-text className="scroll-on-hover__content">{id}</span>
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </div>
          </aside>
          <nav className="col-start-2 flex items-center px-3 border-b border-separator gap-2">
            <TagGroup
              selectionMode="single"
              selectedKeys={new Set([tab])}
              onSelectionChange={(keys) => {
                const k = Array.from(keys || [])[0]
                if (!k) return
                setTab(String(k))
                setSelectedFiles(new Set())
              }}
              variant="surface"
              className="flex-1"
            >
              <TagGroup.List className="gap-2">
                <Tag id="images">图片</Tag>
                <Tag id="videos">视频</Tag>
              </TagGroup.List>
            </TagGroup>
            {selectedCount > 0 ? (
              <>
                <span className="text-xs text-muted-foreground">{selectedCount} 已选</span>
                <Button variant="secondary" className="h-9" onClick={() => deleteTargets(Array.from(selectedFiles))}>删除选中</Button>
                <Button variant="tertiary" className="h-9" onClick={() => setSelectedFiles(new Set())}>清空选择</Button>
              </>
            ) : null}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="tertiary" className="h-9 px-3" aria-label="显示日志" onClick={() => setShowLogPanel(v => !v)}>
                日志
              </Button>
              <Button variant="tertiary" className="h-9 px-3" aria-label="打开开发者工具" onClick={() => window.api.openDevTools?.()}>
                DevTools
              </Button>
              <Button variant="tertiary" className="h-9 px-3" aria-label="清空媒体库关联" onClick={clearLibraryLinks}>
                清空媒体库
              </Button>
              <Popover>
                <Popover.Trigger>
                  <Button variant="tertiary" className="w-9 h-9" aria-label="媒体库">📁</Button>
                </Popover.Trigger>
                <Popover.Content className="p-2 bg-surface rounded-lg border border-border">
                  <Button variant="secondary" className="w-full mb-2" onClick={pickLibraries}>选择媒体库</Button>
                  <Button variant="secondary" className="w-full mb-2" onClick={clearCache}>清空缓存</Button>
                  <ListBox aria-label="媒体库" selectionMode="single" className="w-[240px]" onSelectionChange={() => {}}>
                    {libraries.length ? libraries.map(d => (
                      <ListBox.Item key={d} id={d} textValue={d}>{d}</ListBox.Item>
                    )) : <ListBox.Item id="empty" textValue="暂无媒体库">暂无媒体库</ListBox.Item>}
                  </ListBox>
                </Popover.Content>
              </Popover>
              <Button variant="tertiary" className="w-9 h-9" aria-label="重新检索" onClick={rescan}>🔄</Button>
              <Button variant="tertiary" className="w-9 h-9" aria-label="检查更新" onClick={() => window.api.checkUpdates()}>⬆️</Button>
            </div>
          </nav>
          <section className="col-start-2 overflow-hidden">
            <div className="h-full overflow-hidden p-3">
              {tab === 'images' ? (
                <VirtualGrid
                  items={filteredImages}
                  selectedKeys={selectedFiles}
                  onSelectionChange={(keys) => setSelectedFiles(new Set(keys))}
                  enableDragSelect
                  getItemKey={(p) => p}
                  renderItem={(p, { rootRef, isSelected }) => (
                    <MediaCard
                      filePath={p}
                      type="image"
                      selected={isSelected}
                      rootRef={rootRef}
                      onContextMenu={handleCardContextMenu}
                      onOpenImage={handleOpenImage}
                      onOpenVideo={handleOpenVideo}
                      formatBytes={formatBytes}
                      formatDuration={formatDuration}
                      loadVideoMeta={loadVideoMeta}
                      startTitleScroll={startTitleScroll}
                      stopTitleScroll={stopTitleScroll}
                    />
                  )}
                  minItemWidth={180}
                  itemHeight={180}
                  gap={12}
                />
              ) : (
                <VirtualGrid
                  items={filteredVideos}
                  selectedKeys={selectedFiles}
                  onSelectionChange={(keys) => setSelectedFiles(new Set(keys))}
                  enableDragSelect
                  getItemKey={(p) => p}
                  renderItem={(p, { rootRef, isSelected }) => (
                    <MediaCard
                      filePath={p}
                      type="video"
                      selected={isSelected}
                      rootRef={rootRef}
                      thumbPath={videoThumbnails[p]}
                      onContextMenu={handleCardContextMenu}
                      onOpenImage={handleOpenImage}
                      onOpenVideo={handleOpenVideo}
                      formatBytes={formatBytes}
                      formatDuration={formatDuration}
                      loadVideoMeta={loadVideoMeta}
                      startTitleScroll={startTitleScroll}
                      stopTitleScroll={stopTitleScroll}
                    />
                  )}
                  minItemWidth={180}
                  itemHeight={180}
                  gap={12}
                />
              )}
            </div>
          </section>
        </div>
      </main>
      <footer className="border-t border-slate-200">
        <div className="w-full px-4 py-2 text-xs text-slate-600">
          支持扩展: 图片 png, jpg, jpeg, gif, bmp, webp, tiff；视频 mp4, mov, mkv, webm, avi, wmv, m4v
        </div>
      </footer>

      <div
        ref={menuRef}
        className="fixed z-[1100] bg-surface rounded-md shadow-lg text-sm select-none"
        style={{
          left: 0,
          top: 0,
          transform: `translate3d(${menu.x}px, ${menu.y}px, 0)`,
          willChange: 'transform',
          display: menu.visible ? 'block' : 'none'
        }}
      >
        {(menu.targets || []).length <= 1 ? (
          <button className="block w-full text-left px-3 py-2 hover:bg-muted" onClick={() => { window.api.showInFolder(menu.file); closeMenu() }}>
            打开所在文件夹
          </button>
        ) : null}
        <button className="block w-full text-left px-3 py-2 text-danger hover:bg-muted" onClick={() => deleteTargets((menu.targets || []).length ? menu.targets : [menu.file])}>
          {(menu.targets || []).length > 1 ? `删除选中 (${menu.targets.length})` : '删除'}
        </button>
      </div>

      {showLogPanel ? (
        <div className="fixed inset-x-3 bottom-3 z-[1350] h-[240px] rounded-md border border-border bg-black/90 text-emerald-100 shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/20 text-xs">
            <span className="font-medium">调试日志</span>
            <span className="opacity-80">Ctrl+Shift+L 切换</span>
            <span className="opacity-80">Ctrl+Shift+I 或 F12 打开 DevTools</span>
            <Button variant="tertiary" className="h-7 ml-auto px-2" onClick={() => setDebugLogs([])}>清空面板</Button>
            <Button variant="tertiary" className="h-7 px-2" onClick={() => setShowLogPanel(false)}>关闭</Button>
          </div>
          <div className="h-[calc(100%-41px)] overflow-auto px-3 py-2 text-[11px] leading-5 font-mono">
            {debugLogs.length ? debugLogs.slice().reverse().map((entry, idx) => (
              <div key={`${entry.time || 'na'}-${idx}`} className="whitespace-pre-wrap break-all">
                [{formatLogTime(entry.time)}] [{entry.level || 'info'}] {entry.message || ''} {entry.data ? JSON.stringify(entry.data) : ''}
              </div>
            )) : <div className="opacity-70">暂无日志</div>}
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div className="fixed inset-0 z-[1300] bg-black/85 flex items-center justify-center p-6" onClick={() => setPreviewImage(null)}>
          <img
            src={toSafeFileUrl(previewImage)}
            alt=""
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  )
}
