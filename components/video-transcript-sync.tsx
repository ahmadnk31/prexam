'use client'

import { useState, useRef, useCallback } from 'react'
import VideoPlayer, { VideoPlayerRef } from '@/components/video-player'
import TranscriptPanel from '@/components/transcript-panel'

interface Segment {
  id: string
  segment_index: number
  start_time: number
  end_time: number
  text: string
}

interface VideoTranscriptSyncProps {
  video: {
    id: string
    video_url?: string | null
    youtube_url?: string | null
    status: string
    title: string
  }
  segments: Segment[]
  videoId: string
}

export default function VideoTranscriptSync({
  video,
  segments,
  videoId,
}: VideoTranscriptSyncProps) {
  const [currentTime, setCurrentTime] = useState(0)
  const videoPlayerRef = useRef<VideoPlayerRef>(null)

  const handleTimeUpdate = useCallback((time: number) => {
    if (time !== currentTime) {
      setCurrentTime(time)
    }
  }, [currentTime])

  const handleSeek = useCallback((time: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(time)
    }
  }, [])

  return (
    <div className="flex h-full flex-col space-y-6 lg:space-y-6">
      <div className="flex-shrink-0 w-full">
        <VideoPlayer
          ref={videoPlayerRef}
          video={video}
          onTimeUpdate={handleTimeUpdate}
        />
      </div>
      {video.status === 'ready' && segments.length > 0 && (
        <div className="flex-1 min-h-0 w-full lg:flex-1">
          <TranscriptPanel
            videoId={videoId}
            segments={segments}
            status={video.status}
            isYouTube={!!video.youtube_url}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
        </div>
      )}
    </div>
  )
}

