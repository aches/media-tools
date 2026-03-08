const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  selectDirectories: () => ipcRenderer.invoke('select-directories'),
  getCache: () => ipcRenderer.invoke('get-cache'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  clearLibraryLinks: () => ipcRenderer.invoke('clear-library-links'),
  getDebugLogs: () => ipcRenderer.invoke('get-debug-logs'),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  rescanLibraries: () => ipcRenderer.invoke('rescan-libraries'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  deleteFiles: (filePaths) => ipcRenderer.invoke('delete-files', filePaths),
  openVideo: (filePath) => ipcRenderer.invoke('open-video-window', filePath),
  onUpdateStatus: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
  onLibrarySync: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('library-sync', handler)
    return () => ipcRenderer.removeListener('library-sync', handler)
  },
  onDebugLog: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('debug-log', handler)
    return () => ipcRenderer.removeListener('debug-log', handler)
  },
  onToggleLogPanel: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('toggle-log-panel', handler)
    return () => ipcRenderer.removeListener('toggle-log-panel', handler)
  }
})
