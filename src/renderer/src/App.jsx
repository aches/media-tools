import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Tabs, TagGroup, Tag, ListBox, Popover } from '@heroui/react'
import VirtualGrid from './components/VirtualGrid.jsx'

export default function App() {
  const [libraries, setLibraries] = useState([])
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [videoThumbnails, setVideoThumbnails] = useState({})
  const [tab, setTab] = useState('images')
  const [imagesFolder, setImagesFolder] = useState('all')
  const [videosFolder, setVideosFolder] = useState('all')
  const [updateStatus, setUpdateStatus] = useState('')
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, file: null })
  const menuRef = useRef(null)

  useEffect(() => {
    window.api.getCache().then(cache => {
      setLibraries(cache.libraries || [])
      setImages(cache.images || [])
      setVideos(cache.videos || [])
      setVideoThumbnails(cache.videoThumbnails || {})
    })
    const offUpdate = window.api.onUpdateStatus(s => {
      if (s.status === 'checking') setUpdateStatus('正在检查更新')
      else if (s.status === 'available') setUpdateStatus('发现更新，正在下载')
      else if (s.status === 'downloading') setUpdateStatus(`下载中 ${Math.round(s.progress || 0)}%`)
      else if (s.status === 'ready') setUpdateStatus('更新已下载，稍后将安装')
      else if (s.status === 'none') setUpdateStatus('暂无可用更新')
      else if (s.status === 'error') setUpdateStatus('更新出错')
    })
    const offSync = window.api.onLibrarySync(s => {
      setLibraries(s.current.libraries || [])
      setImages(s.current.images || [])
      setVideos(s.current.videos || [])
      setVideoThumbnails(s.current.videoThumbnails || {})
    })
    return () => {
      offUpdate?.()
      offSync?.()
    }
  }, [])

  useEffect(() => {
    if (!menu.visible) return
    const close = () => setMenu({ visible: false, x: 0, y: 0, file: null })
    const onMouseDown = (e) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) close()
    }
    const onScroll = () => close()
    const onResize = () => close()
    document.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [menu.visible])

  const pickLibraries = async () => {
    const cache = await window.api.selectDirectories()
    setLibraries(cache.libraries || [])
    setImages(cache.images || [])
    setVideos(cache.videos || [])
    setVideoThumbnails(cache.videoThumbnails || {})
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
    video.src = `safe-file://${filePath}`
  })

  const LazyMedia = ({ src, alt, rootRef, wrapperClassName, imgClassName, placeholderClassName, onLoad }) => {
    const wrapperRef = useRef(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
      if (visible) return
      const el = wrapperRef.current
      if (!el) return
      const root = rootRef?.current || null
      if (!root) {
        setVisible(true)
        return
      }
      const io = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            io.disconnect()
            break
          }
        }
      }, { root, rootMargin: '200px', threshold: 0.01 })
      io.observe(el)
      return () => io.disconnect()
    }, [rootRef, visible])

    return (
      <div ref={wrapperRef} className={wrapperClassName}>
        {visible ? (
          <img src={src} alt={alt} loading="lazy" className={imgClassName} onLoad={onLoad} />
        ) : (
          <div className={placeholderClassName} />
        )}
      </div>
    )
  }

  const MediaCard = ({ filePath, type, rootRef, thumbPath }) => {
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
        if (!cached.size) {
          const basic = await window.api.getFileInfo(filePath)
          if (basic?.size != null) {
            setInfo(prev => ({ ...prev, size: basic.size, name: basic.name }))
          }
        }
        if (type === 'video' && (!cached.duration || !cached.width || !cached.height)) {
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

    const handleClick = () => {
      if (type === 'video') window.api.openVideo(filePath)
    }

    const handleContextMenu = (event) => {
      event.preventDefault()
      setMenu({ visible: true, x: event.clientX, y: event.clientY, file: filePath })
    }

    return (
      <div
        className="group relative border border-separator rounded-md p-2 bg-surface flex flex-col gap-2"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
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

  const ImageCards = useMemo(() => (
    images.length ? images
      .filter(p => imagesFolder === 'all' || p.split('/').slice(-2, -1)[0] === imagesFolder)
      .map(p => (
      <div key={p} className="border border-slate-200 rounded-md p-2 bg-white flex flex-col gap-2">
        <img src={`safe-file://${p}`} alt="" className="w-full h-32 object-cover rounded" />
        <div className="text-xs text-slate-600 truncate">{p.split('/').pop()}</div>
      </div>
    )) : <div className="p-6 text-slate-500">暂无图片</div>
  ), [images, imagesFolder])

  const VideoCards = useMemo(() => (
    videos.length ? videos
      .filter(p => videosFolder === 'all' || p.split('/').slice(-2, -1)[0] === videosFolder)
      .map(p => {
      const thumb = videoThumbnails[p]
      return (
      <div key={p} className="border border-slate-200 rounded-md p-2 bg-white flex flex-col gap-2">
        {thumb ? (
          <img src={`safe-file://${thumb}`} alt="" className="w-full h-32 object-cover rounded" />
        ) : (
          <div className="w-full h-32 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-500">无封面</div>
        )}
        <div className="text-xs text-slate-600 truncate">{p.split('/').pop()}</div>
      </div>
      )
    }) : <div className="p-6 text-slate-500">暂无视频</div>
  ), [videos, videoThumbnails, videosFolder])

  const imageDirs = useMemo(() => {
    const set = new Set(images.map(p => p.split('/').slice(-2, -1)[0]).filter(Boolean))
    return ['all', ...Array.from(set).sort()]
  }, [images])

  const videoDirs = useMemo(() => {
    const set = new Set(videos.map(p => p.split('/').slice(-2, -1)[0]).filter(Boolean))
    return ['all', ...Array.from(set).sort()]
  }, [videos])

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
                  if (tab === 'images') setImagesFolder(String(id))
                  else setVideosFolder(String(id))
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
          <nav className="col-start-2 flex items-center px-3 border-b border-separator">
            <TagGroup selectionMode="single" selectedKeys={new Set([tab])} onSelectionChange={(keys) => {
              const k = Array.from(keys || [])[0]
              setTab(String(k))
            }} variant="surface" className="flex-1">
              <TagGroup.List className="gap-2">
                <Tag id="images">图片</Tag>
                <Tag id="videos">视频</Tag>
              </TagGroup.List>
            </TagGroup>
            <div className="flex items-center gap-2 ml-auto">
              <Popover>
                <Popover.Trigger>
                  <Button variant="tertiary" className="w-9 h-9" aria-label="媒体库">📁</Button>
                </Popover.Trigger>
                <Popover.Content className="p-2 bg-surface rounded-lg border border-border">
                  <Button variant="secondary" className="w-full mb-2" onClick={pickLibraries}>选择媒体库</Button>
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
                  items={images.filter(p => imagesFolder === 'all' || p.split('/').slice(-2, -1)[0] === imagesFolder)}
                  renderItem={(p, { rootRef }) => (
                    <MediaCard filePath={p} type="image" rootRef={rootRef} />
                  )}
                  minItemWidth={180}
                  itemHeight={180}
                  gap={12}
                />
              ) : (
                <VirtualGrid
                  items={videos.filter(p => videosFolder === 'all' || p.split('/').slice(-2, -1)[0] === videosFolder)}
                  renderItem={(p, { rootRef }) => (
                    <MediaCard filePath={p} type="video" rootRef={rootRef} thumbPath={videoThumbnails[p]} />
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

      {menu.visible ? (
        <div
          ref={menuRef}
          className="fixed z-[1100] bg-surface border border-border rounded-md shadow-lg text-sm"
          style={{ left: menu.x, top: menu.y }}
        >
          <button className="block w-full text-left px-3 py-2 hover:bg-muted" onClick={() => { window.api.showInFolder(menu.file); setMenu({ visible: false, x: 0, y: 0, file: null }) }}>
            打开所在文件夹
          </button>
          <button className="block w-full text-left px-3 py-2 text-danger hover:bg-muted" onClick={async () => {
            const ok = window.confirm('确定删除此文件？此操作不可恢复')
            if (ok) {
              await window.api.deleteFile(menu.file)
            }
            setMenu({ visible: false, x: 0, y: 0, file: null })
          }}>
            删除
          </button>
        </div>
      ) : null}
    </div>
  )
}
