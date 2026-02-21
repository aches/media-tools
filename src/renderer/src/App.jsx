import React, { useEffect, useMemo, useState } from 'react'
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
      
      
      <main className="container flex-1 px-0 overflow-hidden">
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
                  renderItem={(p) => (
                    <div className="border border-separator rounded-md p-2 bg-surface flex flex-col gap-2">
                      <img src={`safe-file://${p}`} alt="" loading="lazy" className="w-full h-32 object-cover rounded" />
                      <div className="text-xs text-muted truncate">{p.split('/').pop()}</div>
                    </div>
                  )}
                  minItemWidth={180}
                  itemHeight={180}
                  gap={12}
                />
              ) : (
                <VirtualGrid
                  items={videos.filter(p => videosFolder === 'all' || p.split('/').slice(-2, -1)[0] === videosFolder)}
                  renderItem={(p) => {
                    const thumb = videoThumbnails[p]
                    return (
                      <div className="border border-separator rounded-md p-2 bg-surface flex flex-col gap-2">
                        {thumb ? (
                          <img src={`safe-file://${thumb}`} alt="" loading="lazy" className="w-full h-32 object-cover rounded" />
                        ) : (
                          <div className="w-full h-32 rounded bg-muted flex items-center justify-center text-xs text-muted">无封面</div>
                        )}
                        <div className="text-xs text-muted truncate">{p.split('/').pop()}</div>
                      </div>
                    )
                  }}
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
        <div className="container py-2 text-xs text-slate-600">
          支持扩展: 图片 png, jpg, jpeg, gif, bmp, webp, tiff；视频 mp4, mov, mkv, webm, avi, wmv, m4v
        </div>
      </footer>
    </div>
  )
}
