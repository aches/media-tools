export function cn(...args) {
  return args.filter(Boolean).join(' ')
}

export function toSafeFileUrl(filePath) {
  if (!filePath || typeof filePath !== 'string') return ''
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = encodeURI(normalized).replace(/\?/g, '%3F').replace(/#/g, '%23')
  if (encoded.startsWith('/')) return `safe-file://${encoded}`
  return `safe-file:///${encoded}`
}
