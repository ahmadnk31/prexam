'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEffect, useRef, useState } from 'react'
import TextSelectionToolbar from '@/components/text-selection-toolbar'

interface Segment {
  id: string
  segment_index: number
  start_time: number
  end_time: number
  text: string
}

interface TranscriptPanelProps {
  videoId: string
  segments: Segment[]
  status: string
  isYouTube?: boolean
  currentTime?: number
  onSeek?: (time: number) => void
}

export default function TranscriptPanel({
  segments,
  status,
  isYouTube = false,
  currentTime = 0,
  onSeek,
  videoId,
}: TranscriptPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const activeSegmentRef = useRef<HTMLDivElement>(null)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)

  // Find active segment based on current time
  useEffect(() => {
    if (segments.length === 0) return

    // Use a small tolerance to handle timing differences
    const tolerance = 0.5 // 0.5 seconds tolerance
    const activeIndex = segments.findIndex(
      (segment) => 
        currentTime >= (segment.start_time - tolerance) && 
        currentTime <= (segment.end_time + tolerance)
    )

    if (activeIndex !== -1 && activeIndex !== activeSegmentIndex) {
      setActiveSegmentIndex(activeIndex)
    } else if (activeIndex === -1) {
      // Check if we're between segments (within tolerance)
      const isBetweenSegments = segments.some(
        (segment, idx) => 
          idx < segments.length - 1 &&
          currentTime > (segment.end_time - tolerance) &&
          currentTime < (segments[idx + 1].start_time + tolerance)
      )
      
      // If not between segments and we had an active segment, clear it
      if (!isBetweenSegments && activeSegmentIndex !== null) {
      setActiveSegmentIndex(null)
      }
    }
  }, [currentTime, segments, activeSegmentIndex])

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        const segmentTop = activeSegmentRef.current.offsetTop
        const segmentHeight = activeSegmentRef.current.offsetHeight
        const containerHeight = scrollContainer.clientHeight
        const scrollTop = scrollContainer.scrollTop

        // Check if segment is outside visible area
        if (segmentTop < scrollTop || segmentTop + segmentHeight > scrollTop + containerHeight) {
          scrollContainer.scrollTo({
            top: segmentTop - containerHeight / 2 + segmentHeight / 2,
            behavior: 'smooth',
          })
        }
      }
    }
  }, [activeSegmentIndex])

  const handleSegmentClick = (startTime: number) => {
    if (onSeek) {
      onSeek(startTime)
    }
  }

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

      // Check if selection is within the transcript panel
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

  if (status === 'uploading' || status === 'processing' || status === 'transcribing') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-red-600 font-medium">
              Error generating transcript.
            </p>
            {isYouTube ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 font-medium">
                  ⚠️ YouTube transcription failed.
                </p>
                <p className="text-xs text-gray-500">
                  Common causes:
                </p>
                <ul className="text-xs text-gray-500 list-disc list-inside space-y-1 ml-2">
                  <li>YouTube is blocking the download (403 error) - YouTube frequently changes their API</li>
                  <li>Video is private, age-restricted, or region-locked</li>
                  <li>Video format not supported</li>
                  <li>Network or server issues</li>
                </ul>
                <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-1">
                    💡 Solution
                  </p>
                  <p className="text-xs text-blue-600">
                    For reliable transcription, download the video and upload the file directly instead of using a YouTube URL.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">
                  Transcription failed for uploaded video. Possible causes:
                </p>
                <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
                  <li>OpenAI API key missing or invalid</li>
                  <li>Insufficient OpenAI API credits</li>
                  <li>Video file too large (Whisper has size limits)</li>
                  <li>File format not supported</li>
                  <li>File not accessible in Supabase Storage</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Check the server console logs for detailed error messages.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (segments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">No transcript available</p>
        </CardContent>
      </Card>
    )
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <Card className="h-full flex flex-col max-h-[50vh] sm:max-h-[60vh] md:max-h-none">
      <CardHeader className="flex-shrink-0">
        <CardTitle>Transcript</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 min-h-0 h-full overflow-y-auto" ref={scrollAreaRef}>
          <div className="space-y-4 pr-4">
            {segments.map((segment, index) => {
              const isActive = activeSegmentIndex === index
              return (
                <div
                  key={segment.id}
                  ref={isActive ? activeSegmentRef : null}
                  onClick={() => handleSegmentClick(segment.start_time)}
                  className={`space-y-1 p-3 rounded-lg cursor-pointer transition-all ${
                    isActive
                      ? 'bg-blue-50 border-2 border-blue-300 shadow-sm'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono ${
                        isActive ? 'text-blue-700 font-semibold' : 'text-gray-500'
                      }`}
                    >
                      {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                    </span>
                    {isActive && (
                      <span className="text-xs text-blue-600 font-medium">● Playing</span>
                    )}
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      isActive ? 'text-gray-900 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {segment.text}
                  </p>
                </div>
              )
            })}
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
          videoId={videoId}
        />
      )}
    </Card>
  )
}

