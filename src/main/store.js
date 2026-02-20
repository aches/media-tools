const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const STORE_FILE = path.join(app.getPath('userData'), 'media-cache.json')

function loadCache() {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
<<<<<<< HEAD
    return { libraries: [], images: [], videos: [], videoThumbnails: {}, updatedAt: 0 }
=======
    return { libraries: [], images: [], videos: [], updatedAt: 0 }
>>>>>>> 3c2efc4150028cbd5b24dcb12e024524474e68b9
  }
}

function saveCache(data) {
  const payload = {
    libraries: data.libraries || [],
    images: data.images || [],
    videos: data.videos || [],
<<<<<<< HEAD
    videoThumbnails: data.videoThumbnails || {},
=======
>>>>>>> 3c2efc4150028cbd5b24dcb12e024524474e68b9
    updatedAt: Date.now()
  }
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true })
  fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8')
  return payload
}

module.exports = { loadCache, saveCache, STORE_FILE }
