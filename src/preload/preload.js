const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  selectDirectories: () => ipcRenderer.invoke('select-directories'),
  getCache: () => ipcRenderer.invoke('get-cache'),
  rescanLibraries: () => ipcRenderer.invoke('rescan-libraries'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
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
  }
})
