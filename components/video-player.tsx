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
    const [youtubePlayerReady, setYoutubePlayerReady] = useState(false)
    const [youtubeError, setYoutubeError] = useState<string | null>(null)
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
      if (!youtubeId) {
        console.error('Could not extract YouTube ID from URL:', video.youtube_url)
        setYoutubeError('Invalid YouTube URL format')
        return
      }

      console.log('Setting up YouTube player for ID:', youtubeId)
      youtubeIdRef.current = youtubeId
      let playerInitialized = false
      let retryCount = 0
      const maxRetries = 30 // 3 seconds max wait

      const initializePlayer = () => {
        if (playerInitialized || !youtubeIdRef.current) return

        const playerId = `youtube-player-${youtubeIdRef.current}`
        const container = document.getElementById(playerId)
        
        if (!container) {
          retryCount++
          if (retryCount < maxRetries) {
            // Wait a bit for the DOM to be ready
            setTimeout(initializePlayer, 100)
            return
          } else {
            const errorMsg = `YouTube player container not found after ${maxRetries} retries: ${playerId}`
            console.error(errorMsg)
            setYoutubeError(errorMsg)
            return
          }
        }
        
        // Ensure container has proper dimensions
        if (container) {
          const rect = container.getBoundingClientRect()
          console.log('Container dimensions:', { width: rect.width, height: rect.height })
          if (rect.width === 0 || rect.height === 0) {
            console.warn('Container has zero dimensions, this may cause player issues')
          }
        }

        // Check if API is ready
        if (!window.YT || !window.YT.Player) {
          console.warn('YouTube API not ready yet, retrying...')
          setTimeout(initializePlayer, 100)
          return
        }

        playerInitialized = true
        console.log('Initializing YouTube player for:', youtubeIdRef.current)

        try {
          youtubePlayerRef.current = new window.YT.Player(playerId, {
            videoId: youtubeIdRef.current,
            width: '100%',
            height: '100%',
            playerVars: {
              enablejsapi: 1,
              origin: window.location.origin,
              playsinline: 1,
              autoplay: 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
            },
            events: {
              onReady: (event: any) => {
                console.log('YouTube player ready, starting time update polling')
                setYoutubePlayerReady(true)
                setYoutubeError(null)
                // Start polling for time updates when ready
                if (onTimeUpdate) {
                  // Clear any existing interval
                  if (timeUpdateIntervalRef.current) {
                    clearInterval(timeUpdateIntervalRef.current)
                  }
                  timeUpdateIntervalRef.current = setInterval(() => {
                    if (youtubePlayerRef.current) {
                      try {
                        const currentTime = youtubePlayerRef.current.getCurrentTime()
                        if (currentTime !== undefined && currentTime !== null && !isNaN(currentTime) && currentTime > 0) {
                          onTimeUpdate(currentTime)
                        }
                      } catch (e) {
                        // Player might not be ready yet or video paused
                      }
                    }
                  }, 100) // Update every 100ms for smoother sync
                }
              },
              onError: (event: any) => {
                console.error('YouTube player error:', event.data)
                setYoutubeError(`Error ${event.data}`)
                // Error codes: 2=invalid ID, 5=HTML5 error, 100=video not found, 101/150=not allowed
                if (event.data === 100 || event.data === 101 || event.data === 150) {
                  const errorMsg = 'Video is not available (private, restricted, or removed)'
                  console.error(errorMsg)
                  setYoutubeError(errorMsg)
                }
              },
              onStateChange: (event: any) => {
                // States: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
                if (event.data === window.YT.PlayerState.PLAYING) {
                  console.log('YouTube video started playing')
                }
              },
            },
          })
        } catch (error) {
          console.error('Error creating YouTube player:', error)
          playerInitialized = false
        }
      }

      // Load YouTube IFrame API
      if (!window.YT) {
        console.log('Loading YouTube IFrame API...')
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        tag.async = true
        tag.defer = true
        
        // Handle script load errors
        tag.onerror = () => {
          console.error('Failed to load YouTube IFrame API - check network or ad blockers')
        }
        
        const firstScriptTag = document.getElementsByTagName('script')[0]
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
        } else {
          document.head.appendChild(tag)
        }

        // Store the original callback if it exists
        const originalCallback = window.onYouTubeIframeAPIReady

        window.onYouTubeIframeAPIReady = () => {
          console.log('YouTube IFrame API ready')
          if (originalCallback) {
            originalCallback()
          }
          // Wait a bit for DOM to be ready
          setTimeout(() => {
            initializePlayer()
          }, 300)
        }
      } else if (window.YT && window.YT.Player) {
        // API already loaded
        console.log('YouTube API already loaded, initializing player...')
        setTimeout(() => {
          initializePlayer()
        }, 200)
      } else {
        // API is loading but not ready yet
        console.log('YouTube API loading, waiting...')
        const checkInterval = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(checkInterval)
            console.log('YouTube API became ready, initializing player...')
            setTimeout(() => {
              initializePlayer()
            }, 200)
          }
        }, 100)
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval)
          if (!playerInitialized) {
            console.error('YouTube API failed to load within 5 seconds')
          }
        }, 5000)
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
        retryCount = 0
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

    // For YouTube videos, use iframe embed with YouTube IFrame API for time tracking
    if (video.youtube_url) {
      const youtubeId = extractYouTubeId(video.youtube_url)
      
      if (youtubeId) {
        return (
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black relative">
                {!youtubePlayerReady && !youtubeError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                    <div className="text-white text-sm">Loading YouTube player...</div>
                  </div>
                )}
                {youtubeError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                    <div className="text-red-400 text-sm text-center px-4">
                      {youtubeError}
                    </div>
                  </div>
                )}
                <div 
                  id={`youtube-player-${youtubeId}`} 
                  className="w-full h-full"
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

