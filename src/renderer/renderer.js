const pickBtn = document.getElementById('pick')
const checkBtn = document.getElementById('check')
const dirLabel = document.getElementById('dir')
const updateLabel = document.getElementById('update')
const tabs = Array.from(document.querySelectorAll('.tab'))
const imagesGrid = document.getElementById('images')
const videosGrid = document.getElementById('videos')

let currentDir = ''
let images = []
let videos = []

function render() {
  dirLabel.textContent = currentDir ? `目录: ${currentDir}` : ''
  imagesGrid.innerHTML = ''
  videosGrid.innerHTML = ''
  if (!images.length && !videos.length) {
    imagesGrid.innerHTML = '<div class="empty">请选择目录以检索媒体文件</div>'
    return
  }
  for (const p of images) {
    const card = document.createElement('div')
    card.className = 'card'
    const img = document.createElement('img')
    img.src = `file://${p}`
    const name = document.createElement('div')
    name.textContent = p.split('/').pop()
    card.appendChild(img)
    card.appendChild(name)
    imagesGrid.appendChild(card)
  }
  for (const p of videos) {
    const card = document.createElement('div')
    card.className = 'card'
    const vid = document.createElement('video')
    vid.src = `file://${p}`
    vid.controls = true
    const name = document.createElement('div')
    name.textContent = p.split('/').pop()
    card.appendChild(vid)
    card.appendChild(name)
    videosGrid.appendChild(card)
  }
}

pickBtn.addEventListener('click', async () => {
  const res = await window.api.selectDirectory()
  currentDir = res.dir || ''
  images = res.images || []
  videos = res.videos || []
  render()
})

tabs.forEach(t => {
  t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'))
    t.classList.add('active')
    const tab = t.dataset.tab
    imagesGrid.style.display = tab === 'images' ? '' : 'none'
    videosGrid.style.display = tab === 'videos' ? '' : 'none'
  })
})

checkBtn.addEventListener('click', async () => {
  updateLabel.textContent = '正在检查更新'
  const ok = await window.api.checkUpdates()
  if (!ok) updateLabel.textContent = '更新检查失败'
})

window.api.onUpdateStatus((s) => {
  if (s.status === 'checking') updateLabel.textContent = '正在检查更新'
  else if (s.status === 'available') updateLabel.textContent = '发现更新，正在下载'
  else if (s.status === 'downloading') updateLabel.textContent = `下载中 ${Math.round(s.progress || 0)}%`
  else if (s.status === 'ready') updateLabel.textContent = '更新已下载，稍后将安装'
  else if (s.status === 'none') updateLabel.textContent = '暂无可用更新'
  else if (s.status === 'error') updateLabel.textContent = '更新出错'
})
