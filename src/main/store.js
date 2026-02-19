const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const STORE_FILE = path.join(app.getPath('userData'), 'media-cache.json')

function loadCache() {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { libraries: [], images: [], videos: [], updatedAt: 0 }
  }
}

function saveCache(data) {
  const payload = {
    libraries: data.libraries || [],
    images: data.images || [],
    videos: data.videos || [],
    updatedAt: Date.now()
  }
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true })
  fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8')
  return payload
}

module.exports = { loadCache, saveCache, STORE_FILE }
