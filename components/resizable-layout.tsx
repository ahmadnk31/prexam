'use client'

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { GripVertical } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ResizableLayoutProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftSize?: number
  minLeftSize?: number
  minRightSize?: number
}

export default function ResizableLayout({
  leftPanel,
  rightPanel,
  defaultLeftSize = 65,
  minLeftSize = 30,
  minRightSize = 25,
}: ResizableLayoutProps) {
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    setMounted(true)
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMobile(width < 768) // < md
      setIsTablet(width >= 768 && width < 1024) // md to lg
      setIsDesktop(width >= 1024) // >= lg
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // During SSR and initial render, show desktop layout to avoid hydration mismatch
  // Then switch to correct layout after mount
  if (!mounted) {
    return (
      <div className="h-full">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={defaultLeftSize} minSize={minLeftSize}>
            <div className="h-full pr-4">{leftPanel}</div>
          </Panel>
          <PanelResizeHandle className="group relative w-2 bg-transparent transition-colors hover:bg-blue-200 active:bg-blue-300 cursor-col-resize">
            <div className="absolute inset-y-0 left-1/2 flex w-8 -translate-x-1/2 items-center justify-center">
              <GripVertical className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </PanelResizeHandle>
          <Panel defaultSize={100 - defaultLeftSize} minSize={minRightSize}>
            <div className="h-full pl-4 overflow-y-auto">{rightPanel}</div>
          </Panel>
        </PanelGroup>
      </div>
    )
  }

  // Render only one layout based on screen size to avoid duplicate components
  if (isMobile) {
    return (
      <div className="space-y-6">
        <div className="w-full">{leftPanel}</div>
        <div className="w-full">{rightPanel}</div>
      </div>
    )
  }

  if (isTablet) {
    return (
      <div className="grid grid-cols-2 gap-4 h-full">
        <div className="h-full overflow-y-auto pr-2">{leftPanel}</div>
        <div className="h-full overflow-y-auto pl-2">{rightPanel}</div>
      </div>
    )
  }

  // Desktop with resizer
  return (
    <div className="h-full">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={defaultLeftSize} minSize={minLeftSize}>
          <div className="h-full pr-4">{leftPanel}</div>
        </Panel>
        <PanelResizeHandle className="group relative w-2 bg-transparent transition-colors hover:bg-blue-200 active:bg-blue-300 cursor-col-resize">
          <div className="absolute inset-y-0 left-1/2 flex w-8 -translate-x-1/2 items-center justify-center">
            <GripVertical className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
        </PanelResizeHandle>
        <Panel defaultSize={100 - defaultLeftSize} minSize={minRightSize}>
          <div className="h-full pl-4 overflow-y-auto">{rightPanel}</div>
        </Panel>
      </PanelGroup>
    </div>
  )
}

