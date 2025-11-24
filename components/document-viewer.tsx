'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useState, useCallback, useRef, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
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
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Handle text selection
  const handleMouseUp = useCallback((event: MouseEvent) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setSelectionPosition(null)
      setSelectedText('')
      return
    }

    const selectedText = selection.toString().trim()
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

    // Check if selection is within the document viewer
    const range = selection.getRangeAt(0)
    const startContainer = range.startContainer
    const endContainer = range.endContainer
    
    // Get the document viewer element
    const documentPanelElement = (scrollAreaRef.current || mobileScrollRef.current)?.closest('.document-viewer')
    
    if (!documentPanelElement) {
      setSelectionPosition(null)
      setSelectedText('')
      return
    }

    // Helper to get element from node
    const getElement = (node: Node): Element | null => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return node as Element
      }
      return node.parentElement
    }

    // Check if start or end of selection is within document viewer
    const startElement = getElement(startContainer)
    const endElement = getElement(endContainer)
    
    const isStartInViewer = startElement && documentPanelElement.contains(startElement)
    const isEndInViewer = endElement && documentPanelElement.contains(endElement)
    
    if (!isStartInViewer && !isEndInViewer) {
      setSelectionPosition(null)
      setSelectedText('')
      return
    }

    // Get the bounding rect for positioning
    const rect = range.getBoundingClientRect()

    setSelectedText(selectedText)
    setSelectionPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 10,
    })
  }, [])

  useEffect(() => {
    window.document.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseUp])

  // Handle scroll to show/hide scroll-to-top button (for desktop ScrollArea)
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollContainer) return

    const handleScroll = () => {
      setShowScrollTop((scrollContainer as HTMLElement).scrollTop > 300)
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    // Try mobile scroll container first
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Try desktop ScrollArea viewport
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (scrollContainer) {
      (scrollContainer as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

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
      <CardHeader className="flex-shrink-0 px-4 sm:px-6">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <span>Document Content</span>
          {document.page_count && (
            <span className="text-xs sm:text-sm font-normal text-purple-600/70">
              {document.page_count} {document.page_count === 1 ? 'page' : 'pages'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col p-0 relative">
        {/* Mobile: Fixed height with overflow-y */}
        <div 
          className="md:hidden h-[60vh] overflow-y-auto px-4 py-4"
          ref={mobileScrollRef}
          onScroll={(e) => {
            const target = e.target as HTMLElement
            setShowScrollTop(target.scrollTop > 300)
          }}
          style={{ 
            scrollbarWidth: 'thin', 
            scrollbarColor: '#c4b5fd transparent',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="prose prose-sm max-w-none">
            {chunks.length > 0 ? (
              <div className="space-y-6">
                {chunks.map((chunk) => (
                  <div key={chunk.id} className="space-y-2 scroll-mt-4" id={`chunk-${chunk.chunk_index}`}>
                    {chunk.page_number && (
                      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm text-xs font-medium text-purple-600/70 border-b border-purple-200 pb-2 pt-2 -mt-2">
                        Page {chunk.page_number}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
                {content}
              </p>
            )}
          </div>
        </div>

        {/* Desktop: Use ScrollArea */}
        <ScrollArea className="hidden md:flex flex-1 min-h-0" ref={scrollAreaRef}>
          <div className="prose prose-sm max-w-none px-4 sm:px-6 py-4">
            {chunks.length > 0 ? (
              <div className="space-y-6">
                {chunks.map((chunk) => (
                  <div key={chunk.id} className="space-y-2 scroll-mt-4" id={`chunk-${chunk.chunk_index}`}>
                    {chunk.page_number && (
                      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm text-xs font-medium text-purple-600/70 border-b border-purple-200 pb-2 pt-2 -mt-2">
                        Page {chunk.page_number}
                      </div>
                    )}
                    <p className="text-sm sm:text-base leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm sm:text-base leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
                {content}
              </p>
            )}
          </div>
        </ScrollArea>
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            size="sm"
            className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 rounded-full h-10 w-10 p-0 shadow-lg bg-purple-600 hover:bg-purple-700 text-white z-20"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
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
        />
      )}
    </Card>
  )
}

