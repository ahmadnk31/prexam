'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Sparkles, X, Loader2, GripVertical } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface TextSelectionToolbarProps {
  selectedText: string
  position: { x: number; y: number }
  onClose: () => void
  videoId: string
}

export default function TextSelectionToolbar({
  selectedText,
  position,
  onClose,
  videoId,
}: TextSelectionToolbarProps) {
  const [action, setAction] = useState<'summarize' | 'explain' | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({ width: 400, height: 300 })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  // Calculate initial position
  const initialPosition = dragPosition || position

  useEffect(() => {
    // Adjust position if toolbar goes off screen (only on initial render)
    if (toolbarRef.current && !dragPosition) {
      const rect = toolbarRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = position.x
      let adjustedY = position.y + 20

      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10
      }
      if (adjustedX < 10) {
        adjustedX = 10
      }
      if (rect.bottom > viewportHeight) {
        adjustedY = position.y - rect.height - 10
      }
      if (adjustedY < 10) {
        adjustedY = 10
      }

      if (adjustedX !== position.x || adjustedY !== position.y + 20) {
        setDragPosition({ x: adjustedX, y: adjustedY })
      }
    }
  }, [position, dragPosition])

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !toolbarRef.current) return

      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      const currentX = dragPosition?.x || position.x
      const currentY = dragPosition?.y || position.y + 20

      const newX = currentX + deltaX
      const newY = currentY + deltaY

      // Keep within viewport bounds
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const constrainedX = Math.max(10, Math.min(newX, viewportWidth - size.width - 10))
      const constrainedY = Math.max(10, Math.min(newY, viewportHeight - size.height - 10))

      setDragPosition({ x: constrainedX, y: constrainedY })
      dragStartRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragPosition, position, size])

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return

      const deltaX = e.clientX - resizeStartRef.current.x
      const deltaY = e.clientY - resizeStartRef.current.y

      const newWidth = Math.max(300, Math.min(800, resizeStartRef.current.width + deltaX))
      const newHeight = Math.max(200, Math.min(600, resizeStartRef.current.height + deltaY))

      setSize({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleDragStart = (e: React.MouseEvent) => {
    if (isResizing) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    if (toolbarRef.current) {
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      }
    }
  }

  const handleAction = async (actionType: 'summarize' | 'explain') => {
    setAction(actionType)
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: selectedText,
          action: actionType,
          videoId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze text')
      }

      if (!data.result) {
        throw new Error('No result returned from server')
      }

      setResult(data.result)
    } catch (error: any) {
      console.error('Error analyzing text:', error)
      setResult(`Error: ${error.message || 'Failed to analyze text. Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div
        ref={toolbarRef}
        data-selection-toolbar
        className="fixed z-50 rounded-lg border bg-white shadow-lg cursor-move"
        style={{
          left: `${initialPosition.x}px`,
          top: `${initialPosition.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Card className="flex flex-col h-full">
          <CardHeader 
            className="pb-3 cursor-move select-none flex-shrink-0"
            onMouseDown={handleDragStart}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-gray-400" />
                <CardTitle className="text-sm font-medium capitalize">
                  {action === 'summarize' ? 'Summary' : 'Explanation'}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setResult(null)
                  setAction(null)
                  onClose()
                }}
                className="h-6 w-6 p-0 cursor-pointer"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="prose prose-sm max-w-none text-sm flex-1 overflow-y-auto pr-2">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
            <div className="mt-4 flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult(null)
                  setAction(null)
                }}
                className="flex-1"
                onMouseDown={(e) => e.stopPropagation()}
              >
                New Analysis
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result)
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize group"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute bottom-0 right-0 w-full h-full bg-gray-200 group-hover:bg-gray-300 transition-colors rounded-tl-lg flex items-end justify-end p-1">
            <div className="flex gap-0.5">
              <div className="w-1 h-1 bg-gray-500 rounded-full" />
              <div className="w-1 h-1 bg-gray-500 rounded-full" />
              <div className="w-1 h-1 bg-gray-500 rounded-full" />
            </div>
            <div className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-gray-500 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={toolbarRef}
      data-selection-toolbar
      className="fixed z-50 flex gap-2 rounded-lg border bg-white p-2 shadow-lg"
      style={{
        left: `${initialPosition.x}px`,
        top: `${initialPosition.y}px`,
      }}
    >
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAction('summarize')}
        disabled={loading}
        className="gap-2"
      >
        {loading && action === 'summarize' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Summarize
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAction('explain')}
        disabled={loading}
        className="gap-2"
      >
        {loading && action === 'explain' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Brain className="h-4 w-4" />
        )}
        Explain
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClose}
        className="h-8 w-8 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

