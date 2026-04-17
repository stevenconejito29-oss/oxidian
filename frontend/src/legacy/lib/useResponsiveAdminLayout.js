import { useEffect, useState } from 'react'

function readViewport() {
  if (typeof window === 'undefined') {
    return {
      width: 1440,
      isPhone: false,
      isTablet: false,
      isCompact: false,
    }
  }

  const width = window.innerWidth || 1440
  return {
    width,
    isPhone: width <= 640,
    isTablet: width <= 900,
    isCompact: width <= 1180,
  }
}

export function useResponsiveAdminLayout() {
  const [viewport, setViewport] = useState(readViewport)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    function handleResize() {
      setViewport(readViewport())
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return viewport
}
