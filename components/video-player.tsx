'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'

// YouTube IFrame API types
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}
import { 
  isYouTubeProvider, 
  MediaPlayer, 
  MediaProvider, 
  MediaProviderAdapter, 
  useMediaPlayer, 
  useMediaProvider, 
  useMediaStore,
  PlayButton
} from '@vidstack/react'
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

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

// Inner component that uses Vidstack hooks (must be inside MediaPlayer)
function YouTubePlayerControls({ 
  onTimeUpdate,
  onPlayerReady
}: { 
  onTimeUpdate?: (currentTime: number) => void
  onPlayerReady?: (player: any) => void
}) {
  const provider = useMediaProvider()
  const mediaPlayer = useMediaPlayer()
  const { currentTime } = useMediaStore()
  
  // Configure YouTube provider and notify parent
  useEffect(() => {
    if (provider && 'type' in provider && provider.type === 'youtube') {
      // Configure YouTube provider
      if ('cookies' in provider) {
        (provider as any).cookies = true
      }
    }
    
    if (mediaPlayer && onPlayerReady) {
      onPlayerReady(mediaPlayer)
    }
  }, [provider, mediaPlayer, onPlayerReady])
  
  // Set up time update polling when media player is ready
  useEffect(() => {
    if (!onTimeUpdate) return

    // Set up time update polling
    const interval = setInterval(() => {
      if (currentTime > 0) {
        onTimeUpdate(currentTime)
      }
    }, 100)

    return () => {
      clearInterval(interval)
    }
  }, [currentTime, onTimeUpdate])

  return null // This component doesn't render anything
}

// YouTube Player Component - using standard iframe for reliability
function YouTubePlayer({ 
  youtubeUrl, 
  onTimeUpdate,
  onPlayerReady
}: { 
  youtubeUrl: string
  onTimeUpdate?: (currentTime: number) => void
  onPlayerReady?: (player: any) => void
}) {
  const youtubeId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] || 
                    youtubeUrl.match(/^([a-zA-Z0-9_-]{11})$/)?.[1]
  
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!youtubeId) return

    // Only initialize API if we need time updates or player ready callback
    if (!onTimeUpdate && !onPlayerReady) return

    // Wait for iframe to be in the DOM
    if (!iframeRef.current) {
      // Retry after a short delay
      const timeout = setTimeout(() => {
        // This will trigger the effect again if iframe is still not ready
      }, 100)
      return () => clearTimeout(timeout)
    }

    // Load YouTube IFrame API
    if (!window.YT) {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
      if (!existingScript) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        tag.async = true
        const firstScriptTag = document.getElementsByTagName('script')[0]
        if (firstScriptTag?.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
        }
      }
    }

    let player: any = null
    let isInitialized = false
    const playerId = `youtube-player-${youtubeId}-${Date.now()}`

    // Give iframe a unique ID for the API
    if (iframeRef.current && !iframeRef.current.id) {
      iframeRef.current.id = playerId
    }

    const initializePlayer = () => {
      // Prevent multiple initializations
      if (isInitialized || !iframeRef.current) return
      
      if (window.YT && window.YT.Player) {
        try {
          // Check if player already exists
          if (iframeRef.current.dataset.playerInitialized === 'true') {
            return
          }

          isInitialized = true
          iframeRef.current.dataset.playerInitialized = 'true'
          
          // Attach API to existing iframe - don't recreate it
          player = new window.YT.Player(iframeRef.current.id || playerId, {
            events: {
              onReady: () => {
                if (onPlayerReady) {
                  onPlayerReady(player)
                }
                // Start time update polling only if needed
                if (onTimeUpdate) {
                  timeUpdateIntervalRef.current = setInterval(() => {
                    try {
                      if (player && typeof player.getCurrentTime === 'function') {
                        const currentTime = player.getCurrentTime()
                        if (currentTime > 0) {
                          onTimeUpdate(currentTime)
                        }
                      }
                    } catch (e) {
                      // Player might not be ready or was destroyed
                    }
                  }, 100)
                }
              },
              onError: (event: any) => {
                console.error('YouTube player error:', event.data)
              }
            }
          })
        } catch (e) {
          console.error('Error initializing YouTube player:', e)
          isInitialized = false
          if (iframeRef.current) {
            iframeRef.current.dataset.playerInitialized = 'false'
          }
        }
      } else {
        setTimeout(initializePlayer, 100)
      }
    }

    // Wait for API to load
    if (window.YT && window.YT.Player) {
      // API already loaded - wait a bit for iframe to be ready
      setTimeout(initializePlayer, 500)
    } else {
      // Wait for API to load
      const originalCallback = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (originalCallback) originalCallback()
        setTimeout(initializePlayer, 1000) // Give iframe more time to load
      }
    }

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
        timeUpdateIntervalRef.current = null
      }
      // CRITICAL: Don't destroy the player - it causes the black screen
      // The iframe will handle cleanup naturally
      isInitialized = false
    }
  }, [youtubeId, onTimeUpdate, onPlayerReady])

  if (!youtubeId) return null

  const playerId = `youtube-player-${youtubeId}`
  const embedUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&playsinline=1&controls=1&rel=0&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`

  return (
    <div className="w-full aspect-video relative bg-black rounded-lg overflow-hidden">
      <iframe
        id={playerId}
        ref={iframeRef}
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title="YouTube video player"
        frameBorder="0"
      />
    </div>
  )
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ video, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const plyrRef = useRef<any>(null)
    const mediaPlayerRef = useRef<any>(null)
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

    // Handle YouTube player ready callback
    const handleYouTubePlayerReady = (player: any) => {
      mediaPlayerRef.current = player
    }

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (mediaPlayerRef.current) {
          mediaPlayerRef.current.currentTime = time
        } else if (plyrRef.current) {
          plyrRef.current.currentTime = time
        } else if (videoRef.current) {
          videoRef.current.currentTime = time
        }
      },
      getCurrentTime: () => {
        if (mediaPlayerRef.current) {
          return mediaPlayerRef.current.currentTime || 0
        } else if (plyrRef.current) {
          return plyrRef.current.currentTime || 0
        } else if (videoRef.current) {
          return videoRef.current.currentTime
        }
        return 0
      },
    }))


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

    // For YouTube videos, use Vidstack MediaPlayer
    if (video.youtube_url) {
      const youtubeId = extractYouTubeId(video.youtube_url)
      
      if (youtubeId) {
        // Construct YouTube URL
        const youtubeUrl = video.youtube_url.startsWith('http') 
          ? video.youtube_url 
          : `https://www.youtube.com/watch?v=${youtubeId}`
        
        return (
          <Card className="w-full">
            <CardContent className="p-0 w-full">
              <div className="w-full rounded-lg overflow-hidden bg-black">
                <YouTubePlayer 
                  youtubeUrl={youtubeUrl}
                  onTimeUpdate={onTimeUpdate}
                  onPlayerReady={handleYouTubePlayerReady}
                />
              </div>
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

