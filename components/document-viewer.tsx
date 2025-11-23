'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useState, useCallback, useRef, useEffect } from 'react'
import TextSelectionToolbar from '@/components/text-selection-toolbar'

interface DocumentChunk {
  id: string
  chunk_index: number
  content: string
  page_number: number | null
}

interface DocumentViewerProps {
  document: {
    id: string
    title: string
    file_type: string
    status: string
    extracted_text?: string | null
    page_count?: number | null
  }
  chunks: DocumentChunk[]
  documentId: string
}

export default function DocumentViewer({
  document,
  chunks,
  documentId,
}: DocumentViewerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false)

  // Handle text selection
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (isDraggingToolbar) {
      setIsDraggingToolbar(false)
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setSelectionPosition(null)
      setSelectedText('')
      return
    }

    const selectedText = selection.toString().trim()
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Check if selection is within the document viewer
    const documentPanelElement = scrollAreaRef.current?.closest('.document-viewer')
    if (!documentPanelElement || !documentPanelElement.contains(range.commonAncestorContainer)) {
      setSelectionPosition(null)
      setSelectedText('')
      return
    }

    if (selectedText.length < 10) {
      setSelectionPosition(null)
      setSelectedText('')
      return
    }

    // Check if the mouseup event target is part of the toolbar
    const target = event.target as HTMLElement
    if (target.closest('[data-selection-toolbar]')) {
      return
    }

    setSelectedText(selectedText)
    setSelectionPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    })
  }, [isDraggingToolbar])

  useEffect(() => {
    window.document.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseUp])

  if (document.status === 'uploading' || document.status === 'processing') {
    return (
      <Card className="h-full flex flex-col document-viewer">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (document.status === 'error') {
    return (
      <Card className="h-full flex flex-col document-viewer">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col">
          <div className="space-y-2">
            <p className="text-sm text-red-600 font-medium">
              Error processing document.
            </p>
            <p className="text-xs text-gray-600">
              The document could not be processed. Please try uploading again.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chunks.length === 0 && !document.extracted_text) {
    return (
      <Card className="h-full flex flex-col document-viewer">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col">
          <p className="text-sm text-gray-600">No content available</p>
        </CardContent>
      </Card>
    )
  }

  // Use chunks if available, otherwise use full extracted text
  const content = chunks.length > 0 
    ? chunks.map(chunk => chunk.content).join('\n\n')
    : document.extracted_text || ''

  return (
    <Card className="h-full flex flex-col document-viewer">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center justify-between">
          <span>Document Content</span>
          {document.page_count && (
            <span className="text-sm font-normal text-purple-600/70">
              {document.page_count} {document.page_count === 1 ? 'page' : 'pages'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="prose prose-sm max-w-none pr-4">
            {chunks.length > 0 ? (
              <div className="space-y-6">
                {chunks.map((chunk) => (
                  <div key={chunk.id} className="space-y-2">
                    {chunk.page_number && (
                      <div className="text-xs font-medium text-purple-600/70 border-b border-purple-200 pb-1">
                        Page {chunk.page_number}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                {content}
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      {selectionPosition && selectedText && (
        <TextSelectionToolbar
          selectedText={selectedText}
          position={selectionPosition}
          onClose={() => {
            setSelectionPosition(null)
            setSelectedText('')
            window.getSelection()?.removeAllRanges()
          }}
          videoId={documentId}
          onDragStart={() => setIsDraggingToolbar(true)}
        />
      )}
    </Card>
  )
}

