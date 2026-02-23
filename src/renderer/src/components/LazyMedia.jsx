import React, { useEffect, useRef, useState } from 'react'

export default function LazyMedia({ src, alt, rootRef, wrapperClassName, imgClassName, placeholderClassName, onLoad }) {
  const wrapperRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const el = wrapperRef.current
    if (!el) return
    const root = rootRef?.current || null
    if (!root) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
          break
        }
      }
    }, { root, rootMargin: '200px', threshold: 0.01 })
    io.observe(el)
    return () => io.disconnect()
  }, [rootRef, visible])

  return (
    <div ref={wrapperRef} className={wrapperClassName}>
      {visible ? (
        <img src={src} alt={alt} loading="lazy" className={imgClassName} onLoad={onLoad} />
      ) : (
        <div className={placeholderClassName} />
      )}
    </div>
  )
}

