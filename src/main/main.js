const { app, BrowserWindow, ipcMain, dialog, protocol, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')
const ffmpegPath = require('ffmpeg-static')
const { autoUpdater } = require('electron-updater')
const { loadCache, saveCache } = require('./store')

let win
const THUMB_DIR = path.join(app.getPath('userData'), 'video-thumbs')
let loggedFfmpegError = false
const DEBUG_LOG_LIMIT = 400
const debugLogs = []
let resolvedFfmpegPathCache = null

function normalizeLogValue(value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  if (value == null) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function pushDebugLog(level, message, data = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    data: normalizeLogValue(data)
  }
  debugLogs.push(entry)
  if (debugLogs.length > DEBUG_LOG_LIMIT) debugLogs.shift()
  if (win && !win.isDestroyed()) {
    win.webContents.send('debug-log', entry)
  }
}

function reportFfmpegError(reason, extra = {}) {
  if (loggedFfmpegError) return
  loggedFfmpegError = true
  pushDebugLog('error', 'ffmpeg 不可用，视频封面生成失败', { reason, ffmpegPath, resolvedFfmpegPath: getResolvedFfmpegPath(), ...extra })
  console.error('[thumbnail] ffmpeg 不可用，视频封面生成失败', {
    reason,
    ffmpegPath,
    resolvedFfmpegPath: getResolvedFfmpegPath(),
    ...extra
  })
}

function resolveAsarUnpackedPath(binPath) {
  if (!binPath || typeof binPath !== 'string') return ''
  if (!binPath.includes('app.asar')) return binPath
  return binPath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
}

function isRunnableBinaryPath(binPath) {
  if (!binPath || typeof binPath !== 'string') return false
  // ffmpeg cannot be spawned from inside app.asar
  if (binPath.includes('app.asar') && !binPath.includes('app.asar.unpacked')) return false
  try {
    return fs.existsSync(binPath) && fs.statSync(binPath).isFile()
  } catch {
    return false
  }
}

function getFfmpegCandidates() {
  const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const out = []
  const push = (p) => {
    if (!p || out.includes(p)) return
    out.push(p)
  }

  if (ffmpegPath) {
    // Prefer unpacked path first in packaged apps.
    push(resolveAsarUnpackedPath(ffmpegPath))
    push(ffmpegPath)
  }

  if (process.resourcesPath) {
    push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', exeName))
    push(path.join(process.resourcesPath, 'node_modules', 'ffmpeg-static', exeName))
  }

  return out
}

function getResolvedFfmpegPath() {
  if (resolvedFfmpegPathCache) return resolvedFfmpegPathCache
  const candidates = getFfmpegCandidates()
  const found = candidates.find((p) => isRunnableBinaryPath(p))
  resolvedFfmpegPathCache = found || ''
  return resolvedFfmpegPathCache
}

function toSafeFileUrl(filePath) {
  if (!filePath || typeof filePath !== 'string') return ''
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = encodeURI(normalized).replace(/\?/g, '%3F').replace(/#/g, '%23')
  if (encoded.startsWith('/')) return `safe-file://${encoded}`
  return `safe-file:///${encoded}`
}

function resolveSafeFileRequestPath(requestUrl) {
  if (!requestUrl || typeof requestUrl !== 'string') return ''

  try {
    const parsed = new URL(requestUrl)
    let pathname = parsed.pathname || ''
    try {
      pathname = decodeURIComponent(pathname)
    } catch {
      // keep raw pathname
    }

    // legacy format, e.g. safe-file:///%2FUsers%2Fa%2Fxx.jpg
    if (/^\/%2[fF]/.test(parsed.pathname || '')) {
      return pathname.replace(/^\/+/, '/')
    }

    // malformed windows url from old code: safe-file://d/st/file.mp4
    // should be treated as d:/st/file.mp4
    if (/^[A-Za-z]$/.test(parsed.hostname || '')) {
      return `${parsed.hostname}:${pathname}`
    }

    if (parsed.hostname) {
      // UNC path: safe-file://server/share/file
      return `//${parsed.hostname}${pathname}`
    }

    // Windows file URL often comes as /C:/path.
    if (process.platform === 'win32') {
      return pathname.replace(/^\/+([A-Za-z]:[\\/])/, '$1')
    }

    return pathname
  } catch {
    // best-effort fallback for malformed inputs
    const prefix = 'safe-file://'
    if (!requestUrl.startsWith(prefix)) return ''
    let raw = requestUrl.slice(prefix.length)
    const hashIndex = raw.indexOf('#')
    if (hashIndex >= 0) raw = raw.slice(0, hashIndex)
    const queryIndex = raw.indexOf('?')
    if (queryIndex >= 0) raw = raw.slice(0, queryIndex)
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
}

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
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = String(input.key || '').toLowerCase()
    if ((input.control || input.meta) && input.shift && key === 'i') {
      event.preventDefault()
      win.webContents.toggleDevTools()
      return
    }
    if ((input.control || input.meta) && input.shift && key === 'l') {
      event.preventDefault()
      win.webContents.send('toggle-log-panel')
      return
    }
    if (key === 'f12') {
      event.preventDefault()
      win.webContents.toggleDevTools()
    }
  })
  const isDev = !app.isPackaged
  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../renderer/dist/index.html'))
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
  const ffmpegExecPath = getResolvedFfmpegPath()
  if (!ffmpegExecPath || !fs.existsSync(ffmpegExecPath)) {
    reportFfmpegError('not_found', { videoPath, ffmpegExecPath })
    throw new Error('ffmpeg not found')
  }
  pushDebugLog('info', '开始生成视频封面', {
    videoPath,
    thumbPath,
    ffmpegPath,
    ffmpegExecPath
  })
  await fs.promises.mkdir(THUMB_DIR, { recursive: true })
  await new Promise((resolve, reject) => {
    const proc = spawn(
      ffmpegExecPath,
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
    proc.on('error', (err) => {
      reportFfmpegError('spawn_error', { message: err?.message, videoPath, ffmpegExecPath })
      reject(err)
    })
    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else {
        reportFfmpegError('bad_exit', { code, videoPath, ffmpegExecPath })
        reject(new Error(`ffmpeg exit ${code}`))
      }
    })
  })
  pushDebugLog('info', '视频封面生成完成', { videoPath, thumbPath })
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

function emitLibrarySync(saved, added = { images: [], videos: [] }, removed = { images: [], videos: [] }) {
  if (!win) return
  win.webContents.send('library-sync', {
    added,
    removed,
    current: {
      images: saved.images,
      videos: saved.videos,
      libraries: saved.libraries,
      videoThumbnails: saved.videoThumbnails
    }
  })
}

async function refreshCacheFromLibraries(cache = loadCache()) {
  const scanned = await scanLibraries(cache.libraries || [])
  const videoThumbnails = await buildVideoThumbnailMap(scanned.videos, cache.videoThumbnails)
  const saved = saveCache({
    libraries: cache.libraries || [],
    images: scanned.images,
    videos: scanned.videos,
    videoThumbnails
  })
  emitLibrarySync(saved)
  return saved
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

ipcMain.handle('get-debug-logs', async () => {
  return debugLogs
})

ipcMain.handle('open-devtools', async () => {
  if (!win || win.isDestroyed()) return false
  win.webContents.openDevTools({ mode: 'detach' })
  return true
})

ipcMain.handle('clear-cache', async () => {
  const cache = loadCache()
  try {
    await fs.promises.rm(THUMB_DIR, { recursive: true, force: true })
  } catch {}
  const saved = saveCache({
    libraries: cache.libraries || [],
    images: [],
    videos: [],
    videoThumbnails: {}
  })
  emitLibrarySync(
    saved,
    { images: [], videos: [] },
    { images: cache.images || [], videos: cache.videos || [] }
  )
  return saved
})

ipcMain.handle('clear-library-links', async () => {
  const cache = loadCache()
  try {
    await fs.promises.rm(THUMB_DIR, { recursive: true, force: true })
  } catch {}
  const saved = saveCache({
    libraries: [],
    images: [],
    videos: [],
    videoThumbnails: {}
  })
  emitLibrarySync(
    saved,
    { images: [], videos: [] },
    { images: cache.images || [], videos: cache.videos || [] }
  )
  return saved
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

ipcMain.handle('get-file-info', async (_, filePath) => {
  if (!filePath) return null
  try {
    const stat = await fs.promises.stat(filePath)
    return { name: path.basename(filePath), size: stat.size }
  } catch {
    return null
  }
})

ipcMain.handle('open-folder', async (_, folderPath) => {
  if (!folderPath) return false
  try {
    const err = await shell.openPath(folderPath)
    if (err) {
      pushDebugLog('warn', '打开文件夹失败', { folderPath, err })
      return false
    }
    return true
  } catch (error) {
    pushDebugLog('error', '打开文件夹异常', { folderPath, error })
    return false
  }
})

ipcMain.handle('delete-folder', async (_, folderPath) => {
  if (!folderPath) return false
  try {
    await fs.promises.rm(folderPath, { recursive: true, force: true })
    await refreshCacheFromLibraries(loadCache())
    pushDebugLog('info', '文件夹删除完成', { folderPath })
    return true
  } catch (error) {
    pushDebugLog('error', '删除文件夹失败', { folderPath, error })
    return false
  }
})

ipcMain.handle('open-video-window', async (_, filePath) => {
  if (!filePath) return false
  try {
    const w = new BrowserWindow({
      width: 960,
      height: 540,
      show: false,
      title: path.basename(filePath),
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    w.webContents.on('page-title-updated', (e, t) => {
      if (typeof t === 'string' && t.endsWith('::ready')) {
        e.preventDefault?.()
        try { w.show() } catch {}
      }
    })
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${path.basename(filePath)}</title>
          <style>
            html,body{margin:0;height:100%;background:#000}
            .wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000}
            video{width:100%;height:100%;object-fit:contain;background:#000}
          </style>
        </head>
        <body>
          <div class="wrap">
            <video src="${toSafeFileUrl(filePath)}" controls autoplay></video>
          </div>
          <script>
            (function(){
              const win = window
              const video = document.querySelector('video')
              function resizeToFit() {
                const vw = video.videoWidth, vh = video.videoHeight
                if (!vw || !vh) return
                const maxW = Math.min(1280, Math.max(640, vw))
                const maxH = Math.min(720, Math.max(360, vh))
                // fit within limits preserving aspect
                let w = maxW, h = Math.round(maxW * vh / vw)
                if (h > maxH) {
                  h = maxH
                  w = Math.round(maxH * vw / vh)
                }
                const dw = win.outerWidth - win.innerWidth
                const dh = win.outerHeight - win.innerHeight
                try { win.resizeTo(w + dw, h + dh) } catch (e) {}
              }
              function done(){ try { document.title = document.title + '::ready' } catch(e){} }
              if (video.readyState >= 1) { resizeToFit(); done() }
              else { video.addEventListener('loadedmetadata', function(){ resizeToFit(); done() }, { once: true }) }
            })();
          </script>
        </body>
      </html>`
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    return true
  } catch {
    return false
  }
})

ipcMain.handle('show-in-folder', async (_, filePath) => {
  try {
    shell.showItemInFolder(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('delete-file', async (_, filePath) => {
  if (!filePath) return false
  try {
    await fs.promises.unlink(filePath)
  } catch {
    // ignore
  }
  try {
    await refreshCacheFromLibraries(loadCache())
    return true
  } catch {
    return false
  }
})

ipcMain.handle('delete-files', async (_, filePaths) => {
  if (!Array.isArray(filePaths) || !filePaths.length) return false
  try {
    await Promise.all(
      filePaths
        .filter((p) => typeof p === 'string' && p)
        .map(async (filePath) => {
          try {
            await fs.promises.unlink(filePath)
          } catch {}
        })
    )
    await refreshCacheFromLibraries(loadCache())
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
  pushDebugLog('info', '应用启动', {
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    ffmpegPath,
    ffmpegExists: !!ffmpegPath && fs.existsSync(ffmpegPath),
    ffmpegCandidates: getFfmpegCandidates().map((p) => ({
      path: p,
      exists: (() => { try { return fs.existsSync(p) } catch { return false } })(),
      runnable: isRunnableBinaryPath(p)
    })),
    resolvedFfmpegPath: getResolvedFfmpegPath(),
    resolvedFfmpegExists: !!getResolvedFfmpegPath() && fs.existsSync(getResolvedFfmpegPath())
  })
  protocol.registerFileProtocol('safe-file', (request, callback) => {
    const filePath = resolveSafeFileRequestPath(request.url)
    if (!filePath) {
      pushDebugLog('warn', 'safe-file 解析失败', { url: request.url })
      callback({ error: -6 })
      return
    }
    callback(filePath)
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
