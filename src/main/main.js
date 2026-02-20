const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')
const ffmpegPath = require('ffmpeg-static')
const { autoUpdater } = require('electron-updater')
const { loadCache, saveCache } = require('./store')

let win
const THUMB_DIR = path.join(app.getPath('userData'), 'video-thumbs')

// 注册自定义安全协议，允许在 http 开发环境安全加载本地文件
protocol.registerSchemesAsPrivileged?.([
  {
    scheme: 'safe-file',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  const isDev = !app.isPackaged
  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function isImage(p) {
  const ext = path.extname(p).toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff'].includes(ext)
}

function isVideo(p) {
  const ext = path.extname(p).toLowerCase()
  return ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.wmv', '.m4v'].includes(ext)
}

async function walk(dir) {
  const out = { images: [], videos: [] }
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    let entries
    try {
      entries = await fs.promises.readdir(d, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) {
        stack.push(full)
      } else {
        if (isImage(full)) out.images.push(full)
        else if (isVideo(full)) out.videos.push(full)
      }
    }
  }
  return out
}

async function scanLibraries(libraries) {
  const agg = { images: [], videos: [] }
  for (const dir of libraries) {
    const r = await walk(dir)
    agg.images.push(...r.images)
    agg.videos.push(...r.videos)
  }
  agg.images = Array.from(new Set(agg.images))
  agg.videos = Array.from(new Set(agg.videos))
  return agg
}

function getThumbPath(videoPath) {
  const hash = crypto.createHash('sha1').update(videoPath).digest('hex')
  return path.join(THUMB_DIR, `${hash}.jpg`)
}

async function ensureVideoThumbnail(videoPath) {
  const thumbPath = getThumbPath(videoPath)
  try {
    const [vStat, tStat] = await Promise.all([
      fs.promises.stat(videoPath),
      fs.promises.stat(thumbPath)
    ])
    if (tStat.mtimeMs >= vStat.mtimeMs) return thumbPath
  } catch {}
  await fs.promises.mkdir(THUMB_DIR, { recursive: true })
  await new Promise((resolve, reject) => {
    const proc = spawn(
      ffmpegPath,
      [
        '-y',
        '-ss',
        '00:00:01',
        '-i',
        videoPath,
        '-frames:v',
        '1',
        '-vf',
        "scale='min(512,iw)':-2",
        thumbPath
      ],
      { windowsHide: true }
    )
    proc.on('error', reject)
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))))
  })
  return thumbPath
}

async function buildVideoThumbnailMap(videos, prevMap = {}) {
  const map = {}
  for (const v of videos) {
    try {
      map[v] = await ensureVideoThumbnail(v)
    } catch {}
  }
  const current = new Set(videos)
  const removals = Object.keys(prevMap).filter((k) => !current.has(k))
  await Promise.all(
    removals.map(async (k) => {
      const p = prevMap[k]
      if (!p) return
      try {
        await fs.promises.unlink(p)
      } catch {}
    })
  )
  return map
}

ipcMain.handle('select-directories', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] })
  if (res.canceled || !res.filePaths?.length) return loadCache()
  const cache = loadCache()
  const libraries = Array.from(new Set([...(cache.libraries || []), ...res.filePaths]))
  const scanned = await scanLibraries(libraries)
  const videoThumbnails = await buildVideoThumbnailMap(scanned.videos, cache.videoThumbnails)
  const saved = saveCache({ libraries, images: scanned.images, videos: scanned.videos, videoThumbnails })
  return saved
})

ipcMain.handle('get-cache', async () => {
  const cache = loadCache()
  return cache
})

ipcMain.handle('rescan-libraries', async () => {
  const cache = loadCache()
  const scanned = await scanLibraries(cache.libraries || [])
  const addImages = scanned.images.filter(p => !cache.images.includes(p))
  const addVideos = scanned.videos.filter(p => !cache.videos.includes(p))
  const delImages = cache.images.filter(p => !scanned.images.includes(p))
  const delVideos = cache.videos.filter(p => !scanned.videos.includes(p))
  const videoThumbnails = await buildVideoThumbnailMap(scanned.videos, cache.videoThumbnails)
  const saved = saveCache({ libraries: cache.libraries, images: scanned.images, videos: scanned.videos, videoThumbnails })
  if (win) {
    win.webContents.send('library-sync', {
      added: { images: addImages, videos: addVideos },
      removed: { images: delImages, videos: delVideos },
      current: { images: saved.images, videos: saved.videos, libraries: saved.libraries, videoThumbnails: saved.videoThumbnails }
    })
  }
  return saved
})

ipcMain.handle('check-updates', async () => {
  try {
    await autoUpdater.checkForUpdates()
    return true
  } catch {
    return false
  }
})

function setupAutoUpdate() {
  autoUpdater.on('checking-for-update', () => {
    if (win) win.webContents.send('update-status', { status: 'checking' })
  })
  autoUpdater.on('update-available', () => {
    if (win) win.webContents.send('update-status', { status: 'available' })
  })
  autoUpdater.on('update-not-available', () => {
    if (win) win.webContents.send('update-status', { status: 'none' })
  })
  autoUpdater.on('download-progress', (p) => {
    if (win) win.webContents.send('update-status', { status: 'downloading', progress: p.percent })
  })
  autoUpdater.on('update-downloaded', () => {
    if (win) win.webContents.send('update-status', { status: 'ready' })
  })
  autoUpdater.on('error', () => {
    if (win) win.webContents.send('update-status', { status: 'error' })
  })
}

app.whenReady().then(() => {
  protocol.registerFileProtocol('safe-file', (request, callback) => {
    const url = request.url.replace('safe-file://', '')
    try {
      callback({ path: decodeURI(url) })
    } catch {
      callback({ path: '' })
    }
  })
  createWindow()
  // 启动时同步一次媒体库
  const cache = loadCache()
  scanLibraries(cache.libraries || []).then(scanned => {
    buildVideoThumbnailMap(scanned.videos, cache.videoThumbnails).then(videoThumbnails => {
      const saved = saveCache({ libraries: cache.libraries || [], images: scanned.images, videos: scanned.videos, videoThumbnails })
      if (win) {
        win.webContents.send('library-sync', {
          added: { images: [], videos: [] },
          removed: { images: [], videos: [] },
          current: { images: saved.images, videos: saved.videos, libraries: saved.libraries, videoThumbnails: saved.videoThumbnails }
        })
      }
    }).catch(() => {})
  }).catch(() => {})
  setupAutoUpdate()
  autoUpdater.checkForUpdatesAndNotify()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
