'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import VideoTranscriptSync from '@/components/video-transcript-sync'
import AIToolsPanel from '@/components/ai-tools-panel'
import { Card, CardContent } from '@/components/ui/card'
import ResizableLayout from '@/components/resizable-layout'
import { retryTranscription } from '@/app/dashboard/videos/[id]/actions'

interface Video {
  id: string
  title: string
  status: string
  youtube_url?: string | null
  video_url?: string | null
}

interface Segment {
  id: string
  segment_index: number
  start_time: number
  end_time: number
  text: string
}

interface VideoPageClientProps {
  initialVideo: Video
  initialSegments: Segment[]
  videoId: string
}

export default function VideoPageClient({
  initialVideo,
  initialSegments,
  videoId,
}: VideoPageClientProps) {
  const [video, setVideo] = useState<Video>(initialVideo)
  const [segments, setSegments] = useState<Segment[]>(initialSegments)
  const [isPolling, setIsPolling] = useState(
    initialVideo.status === 'processing' || 
    initialVideo.status === 'transcribing' ||
    initialVideo.status === 'uploading'
  )

  useEffect(() => {
    if (!isPolling) return

    const supabase = createClient()
    let pollInterval: NodeJS.Timeout

    const pollVideo = async () => {
      try {
        const { data: updatedVideo, error } = await supabase
          .from('videos')
          .select('*')
          .eq('id', videoId)
          .single()

        if (error) {
          console.error('Error polling video:', error)
          return
        }

        if (updatedVideo) {
          const previousStatus = video.status
          setVideo(updatedVideo as Video)

          // If status changed to ready, fetch segments and stop polling
          if (updatedVideo.status === 'ready' && previousStatus !== 'ready') {
            const { data: updatedSegments, error: segmentsError } = await supabase
              .from('video_segments')
              .select('*')
              .eq('video_id', videoId)
              .order('segment_index', { ascending: true })

            if (!segmentsError && updatedSegments) {
              setSegments(updatedSegments)
              console.log('Segments loaded:', updatedSegments.length)
            }
            setIsPolling(false)
          } else if (updatedVideo.status === 'error') {
            setIsPolling(false)
          }
        }
      } catch (error) {
        console.error('Error in poll:', error)
      }
    }

    // Poll immediately, then every 2 seconds
    pollVideo()
    pollInterval = setInterval(pollVideo, 2000)

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [videoId, isPolling, video.status])

  return (
    <div className="h-auto md:h-[calc(100vh-12rem)] lg:min-h-[600px] lg:max-h-[calc(100vh-12rem)]">
      <ResizableLayout
        defaultLeftSize={65}
        minLeftSize={40}
        minRightSize={25}
        leftPanel={
          <VideoTranscriptSync
            video={video}
            segments={segments}
            videoId={videoId}
          />
        }
        rightPanel={
          <div className="h-full">
            {video.status === 'ready' && (
              <AIToolsPanel videoId={videoId} />
            )}
            {video.youtube_url && video.status === 'error' && (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-red-700 mb-1">
                        ⚠️ YouTube Transcription Failed
                      </p>
                      <p className="text-xs text-gray-600 mb-2">
                        This video could not be transcribed. Common reasons:
                      </p>
                      <ul className="text-xs text-gray-600 list-disc list-inside mb-3 space-y-1">
                        <li>Video does not have captions/subtitles enabled</li>
                        <li>YouTube is blocking downloads (403 Forbidden)</li>
                        <li>Video is private, age-restricted, or region-locked</li>
                      </ul>
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-xs font-medium text-blue-800 mb-1">
                          💡 Recommended Solutions
                        </p>
                        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                          <li>Try a different video with captions/subtitles enabled</li>
                          <li>Download the video from YouTube and upload the file directly</li>
                          <li>Use YouTube's "CC" button to check if captions are available</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {(video.status === 'processing' || video.status === 'transcribing' || (video.status === 'error' && !video.youtube_url)) && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-4">
                    {video.status === 'processing' && 'Video is being processed...'}
                    {video.status === 'transcribing' && 'Video is being transcribed...'}
                    {video.status === 'error' && !video.youtube_url && 'Transcription failed. Click below to retry.'}
                  </p>
                  {video.status === 'error' && (
                    <p className="text-xs text-gray-500 mt-2">
                      Check your OpenAI API key and ensure the video file is accessible.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        }
      />
    </div>
  )
}

