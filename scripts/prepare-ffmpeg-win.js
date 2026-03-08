const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const env = {
  ...process.env,
  npm_config_platform: 'win32',
  npm_config_arch: 'x64'
}

const result = spawnSync(npmCmd, ['rebuild', 'ffmpeg-static'], {
  stdio: 'inherit',
  env
})

if (result.status !== 0) {
  process.exit(result.status || 1)
}

const binPath = path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
if (!fs.existsSync(binPath)) {
  console.error('[prepare:ffmpeg:win] 未找到 ffmpeg.exe，Windows 打包后将无法生成视频封面')
  process.exit(1)
}

console.log(`[prepare:ffmpeg:win] 已准备 Windows ffmpeg: ${binPath}`)
