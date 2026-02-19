import React, { useEffect, useMemo, useState } from 'react'
import { Button, Tabs, Tab, TabList, TabPanel } from '@heroui/react'

export default function App() {
  const [libraries, setLibraries] = useState([])
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [tab, setTab] = useState('images')
  const [updateStatus, setUpdateStatus] = useState('')

  useEffect(() => {
    window.api.getCache().then(cache => {
      setLibraries(cache.libraries || [])
      setImages(cache.images || [])
      setVideos(cache.videos || [])
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
  }

  const rescan = async () => {
    await window.api.rescanLibraries()
  }

  const ImageCards = useMemo(() => (
    images.length ? images.map(p => (
      <div key={p} className="border border-slate-200 rounded-md p-2 bg-white flex flex-col gap-2">
        <img src={`safe-file://${p}`} alt="" className="w-full h-32 object-cover rounded" />
        <div className="text-xs text-slate-600">{p.split('/').pop()}</div>
      </div>
    )) : <div className="p-6 text-slate-500">暂无图片</div>
  ), [images])

  const VideoCards = useMemo(() => (
    videos.length ? videos.map(p => (
      <div key={p} className="border border-slate-200 rounded-md p-2 bg-white flex flex-col gap-2">
        <video src={`safe-file://${p}`} controls className="w-full h-32 rounded" />
        <div className="text-xs text-slate-600">{p.split('/').pop()}</div>
      </div>
    )) : <div className="p-6 text-slate-500">暂无视频</div>
  ), [videos])

  return (
    <div className="flex flex-col h-screen">
      
      <header className="border-b border-slate-200">
        <div className="container py-3 flex items-center gap-2">
          <Button color="primary" onClick={pickLibraries}>选择媒体库</Button>
          <Button variant="bordered" onClick={rescan}>重新检索</Button>
          <Button variant="bordered" onClick={() => window.api.checkUpdates()}>检查更新</Button>
          <div className="ml-auto text-sm text-slate-600">{updateStatus}</div>
        </div>
      </header>
      <div className="container">
        <div className="py-3">
          <div className="flex flex-wrap gap-2">
            {libraries.length ? libraries.map(d => (
              <span key={d} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 bg-slate-50">{d}</span>
            )) : <span className="text-sm text-slate-500">未选择媒体库</span>}
          </div>
        </div>
      </div>
 <Tabs className="w-full max-w-md">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Options">
          <Tabs.Tab id="overview">
            Overview
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="analytics">
            Analytics
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="reports">
            Reports
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel className="pt-4" id="overview">
        <p>View your project overview and recent activity.</p>
      </Tabs.Panel>
      <Tabs.Panel className="pt-4" id="analytics">
        <p>Track your metrics and analyze performance data.</p>
      </Tabs.Panel>
      <Tabs.Panel className="pt-4" id="reports">
        <p>Generate and download detailed reports.</p>
      </Tabs.Panel>
    </Tabs>
      <main className="container flex-1 overflow-auto py-4">
        <Tabs
          selectedKey={tab}
          onSelectionChange={key => setTab(String(key))}
          aria-label="媒体类型"
        >
          <TabList>
            <Tab id="images">图片</Tab>
            <Tab id="videos">视频</Tab>
          </TabList>
          <TabPanel id="images">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {ImageCards}
            </div>
          </TabPanel>
          <TabPanel id="videos">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {VideoCards}
            </div>
          </TabPanel>
        </Tabs>
      </main>
      <footer className="border-t border-slate-200">
        <div className="container py-2 text-xs text-slate-600">
          支持扩展: 图片 png, jpg, jpeg, gif, bmp, webp, tiff；视频 mp4, mov, mkv, webm, avi, wmv, m4v
        </div>
      </footer>
    </div>
  )
}
