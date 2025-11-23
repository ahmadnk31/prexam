'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Brain, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import ReactMarkdown from 'react-markdown'
import TextSelectionToolbar from '@/components/text-selection-toolbar'

interface SummaryPanelProps {
  videoId: string
  content: string | null
  generating: boolean
  onGenerate: () => void
}

export default function SummaryPanel({
  content,
  generating,
  onGenerate,
  videoId,
}: SummaryPanelProps) {
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Handle text selection
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Don't show toolbar if clicking on a button or the toolbar itself
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('[data-selection-toolbar]')) {
        return
      }

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        setSelectionPosition(null)
        setSelectedText('')
        return
      }

      const selectedText = selection.toString().trim()
      if (selectedText.length < 10) {
        // Ignore very short selections
        setSelectionPosition(null)
        setSelectedText('')
        return
      }

      // Check if selection is within the summary content
      const range = selection.getRangeAt(0)
      const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
      if (!scrollContainer || !scrollContainer.contains(range.commonAncestorContainer)) {
        setSelectionPosition(null)
        setSelectedText('')
        return
      }

      const rect = range.getBoundingClientRect()

      setSelectedText(selectedText)
      setSelectionPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom,
      })
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div className="h-full flex flex-col space-y-4 relative">
      <div className="flex-1 min-h-0 flex flex-col space-y-2">
        <p className="text-sm text-gray-600 flex-shrink-0">
          Generate an AI-powered summary of the video content.
        </p>
        {content ? (
          <div className="flex-1 min-h-0 flex flex-col space-y-2">
            <ScrollArea ref={scrollAreaRef} className="flex-1 rounded-lg border p-4">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </ScrollArea>
            <Button onClick={onGenerate} disabled={generating} variant="outline" className="w-full flex-shrink-0">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Regenerate Summary
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            onClick={onGenerate}
            disabled={generating}
            className="w-full"
          >
            {generating ? (
              <>
                <Skeleton className="mr-2 h-4 w-4" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Summary
              </>
            )}
          </Button>
        )}
      </div>
      {selectionPosition && selectedText && (
        <TextSelectionToolbar
          selectedText={selectedText}
          position={selectionPosition}
          onClose={() => {
            setSelectionPosition(null)
            setSelectedText('')
            window.getSelection()?.removeAllRanges()
          }}
          videoId={videoId}
        />
      )}
    </div>
  )
}

