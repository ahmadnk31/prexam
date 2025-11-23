'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

// YouTube IFrame API types
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

interface VideoPlayerProps {
  video: {
    id: string
    video_url?: string | null
    youtube_url?: string | null
    status: string
    title: string
  }
  onTimeUpdate?: (currentTime: number) => void
}

export interface VideoPlayerRef {
  seekTo: (time: number) => void
  getCurrentTime: () => number
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ video, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const plyrRef = useRef<any>(null)
    const youtubePlayerRef = useRef<any>(null)
    const youtubeIdRef = useRef<string | null>(null)
    const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
    // Extract YouTube video ID from various URL formats
    function extractYouTubeId(url: string | null | undefined): string | null {
      if (!url) return null
      
      // Handle various YouTube URL formats:
      // - https://www.youtube.com/watch?v=VIDEO_ID
      // - https://youtu.be/VIDEO_ID
      // - https://www.youtube.com/embed/VIDEO_ID
      // - https://m.youtube.com/watch?v=VIDEO_ID
      // - https://youtube.com/watch?v=VIDEO_ID
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
      ]
      
      for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match && match[1]) {
          return match[1]
        }
      }
      
      return null
    }

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (plyrRef.current) {
          plyrRef.current.currentTime = time
        } else if (youtubePlayerRef.current) {
          youtubePlayerRef.current.seekTo(time, true)
        } else if (videoRef.current) {
          videoRef.current.currentTime = time
        }
      },
      getCurrentTime: () => {
        if (plyrRef.current) {
          return plyrRef.current.currentTime || 0
        } else if (youtubePlayerRef.current) {
          return youtubePlayerRef.current.getCurrentTime() || 0
        } else if (videoRef.current) {
          return videoRef.current.currentTime
        }
        return 0
      },
    }))

    // Handle YouTube IFrame API
    useEffect(() => {
      if (!video.youtube_url) return

      const youtubeId = extractYouTubeId(video.youtube_url)
      if (!youtubeId) return

      youtubeIdRef.current = youtubeId
      let playerInitialized = false

      const initializePlayer = () => {
        if (playerInitialized || !youtubeIdRef.current) return
        playerInitialized = true

        const playerId = `youtube-player-${youtubeIdRef.current}`
        const container = document.getElementById(playerId)
        if (!container) {
          // Wait a bit for the DOM to be ready
          setTimeout(initializePlayer, 100)
          return
        }

        youtubePlayerRef.current = new window.YT.Player(playerId, {
          videoId: youtubeIdRef.current,
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              // Start polling for time updates when ready
              if (onTimeUpdate) {
                timeUpdateIntervalRef.current = setInterval(() => {
                  if (youtubePlayerRef.current) {
                    try {
                      const currentTime = youtubePlayerRef.current.getCurrentTime()
                      if (currentTime !== undefined && currentTime !== null) {
                        onTimeUpdate(currentTime)
                      }
                    } catch (e) {
                      // Player might not be ready yet
                    }
                  }
                }, 250) // Update every 250ms for smoother sync
              }
            },
            onStateChange: (event: any) => {
              // Continue polling regardless of state for better sync
              // The interval is already running from onReady
            },
          },
        })
      }

      // Load YouTube IFrame API
      if (!window.YT) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        const firstScriptTag = document.getElementsByTagName('script')[0]
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

        window.onYouTubeIframeAPIReady = () => {
          initializePlayer()
        }
      } else if (window.YT.Player) {
        // API already loaded
        initializePlayer()
      }

      return () => {
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current)
          timeUpdateIntervalRef.current = null
        }
        if (youtubePlayerRef.current) {
          try {
            youtubePlayerRef.current.destroy()
          } catch (e) {
            // Ignore destroy errors
          }
          youtubePlayerRef.current = null
        }
        playerInitialized = false
      }
    }, [video.youtube_url, onTimeUpdate])

    // Initialize Plyr for HTML5 videos
    useEffect(() => {
      if (video.youtube_url || !video.video_url || video.status !== 'ready') return
      if (!videoRef.current) return

      // Dynamically import Plyr only on client side
      let player: any = null
      let PlyrModule: any = null

      const initPlyr = async () => {
        try {
          // Dynamic import to avoid SSR issues
          PlyrModule = (await import('plyr')).default
          
          // Initialize Plyr
          player = new PlyrModule(videoRef.current, {
            controls: [
              'play-large',
              'play',
              'progress',
              'current-time',
              'duration',
              'mute',
              'volume',
              'settings',
              'pip',
              'fullscreen',
            ],
            settings: ['captions', 'quality', 'speed'],
            keyboard: { focused: true, global: false },
            tooltips: { controls: true, seek: true },
            clickToPlay: true,
            hideControls: true,
            resetOnEnd: false,
          })

          plyrRef.current = player

          // Handle time updates from Plyr
          if (onTimeUpdate) {
            player.on('timeupdate', () => {
              if (onTimeUpdate) {
                onTimeUpdate(player.currentTime)
              }
            })
          }
        } catch (error) {
          console.error('Error initializing Plyr:', error)
        }
      }

      initPlyr()

      return () => {
        if (plyrRef.current) {
          try {
            plyrRef.current.destroy()
          } catch (e) {
            // Ignore destroy errors
          }
          plyrRef.current = null
        }
      }
    }, [video.video_url, video.youtube_url, video.status, onTimeUpdate])

    // For YouTube videos, show them immediately regardless of status
    if (video.youtube_url) {
      const youtubeId = extractYouTubeId(video.youtube_url)
      
      if (youtubeId) {
        return (
          <Card>
            <CardContent className="p-0">
              <div id={`youtube-player-${youtubeId}`} className="aspect-video w-full rounded-lg" />
            </CardContent>
          </Card>
        )
      } else {
        // YouTube URL but couldn't extract ID - show error
        return (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <p className="text-gray-600 mb-2">Invalid YouTube URL</p>
              <p className="text-xs text-gray-500">URL: {video.youtube_url}</p>
            </CardContent>
          </Card>
        )
      }
    }

    // For uploaded videos, show loading state if processing
    if (video.status === 'uploading' || video.status === 'processing' || video.status === 'transcribing') {
      return (
        <Card>
          <CardContent className="p-0">
            <div className="relative">
              <Skeleton className="aspect-video w-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600">
                    {video.status === 'uploading' && 'Uploading video...'}
                    {video.status === 'processing' && 'Processing video...'}
                    {video.status === 'transcribing' && 'Transcribing audio...'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (video.video_url) {
      // Check if it's a full URL or just a path
      const videoSrc = video.video_url.startsWith('http')
        ? video.video_url
        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/${video.video_url}`

      return (
        <Card>
          <CardContent className="p-0">
            <video
              ref={videoRef}
              className="aspect-video w-full rounded-lg"
              playsInline
              src={videoSrc}
              onError={(e) => {
                console.error('Video load error:', e)
              }}
            >
              Your browser does not support the video tag.
            </video>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12">
          <p className="text-gray-600 mb-2">No video available</p>
          <p className="text-xs text-gray-500">Status: {video.status}</p>
          {video.status === 'error' && (
            <p className="text-xs text-red-500 mt-2">There was an error processing this video</p>
          )}
        </CardContent>
      </Card>
    )
  }
)

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer

