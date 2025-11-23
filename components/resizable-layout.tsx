'use client'

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { GripVertical } from 'lucide-react'

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
  return (
    <>
      {/* Desktop: Horizontal layout with resizer */}
      <div className="hidden lg:block h-full">
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

      {/* Tablet: Horizontal layout without resizer (fixed split) */}
      <div className="hidden md:block lg:hidden h-full">
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className="h-full overflow-y-auto pr-2">{leftPanel}</div>
          <div className="h-full overflow-y-auto pl-2">{rightPanel}</div>
        </div>
      </div>

      {/* Mobile: Vertical stacked layout */}
      <div className="block md:hidden space-y-6">
        <div className="w-full">{leftPanel}</div>
        <div className="w-full">{rightPanel}</div>
      </div>
    </>
  )
}

