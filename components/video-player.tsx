'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react'

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
  // Note: origin parameter removed to avoid hydration mismatch (it's optional anyway)
  const embedUrl = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&playsinline=1&controls=1&rel=0`

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
    const [videoError, setVideoError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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


    // Function to initialize Plyr player - use useRef to prevent recreation and infinite loops
    const initPlyrPlayerRef = useRef<(() => Promise<void>) | null>(null)
    
    // Create the init function only once, using refs to avoid dependency issues
    if (!initPlyrPlayerRef.current) {
      initPlyrPlayerRef.current = async () => {
        // Double-check we're not already initialized
        if (plyrRef.current) {
          console.log('Plyr already initialized, skipping')
          return
        }

        if (!videoRef.current) {
          console.warn('Video ref not available for Plyr initialization')
          return
        }

        // Use the video URL from props, not from the element (Plyr might modify element src)
        // Get current video_url from the video prop (accessed via closure)
        const currentVideoUrl = video.video_url
        if (!currentVideoUrl) {
          console.warn('No video URL available for Plyr initialization')
          return
        }

        // Ensure we have a valid video URL
        let videoUrl = currentVideoUrl
        if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
          videoUrl = `https://${videoUrl}`
        }

        // Wait a bit to ensure video element is fully mounted
        await new Promise(resolve => setTimeout(resolve, 200))

        // Check again after delay
        if (!videoRef.current) {
          console.warn('Video ref lost after delay')
          return
        }

        // Final check - don't initialize if already done
        if (plyrRef.current) {
          console.log('Plyr was initialized during delay, skipping')
          return
        }

        try {
          console.log('Starting Plyr initialization with video URL:', videoUrl)
          
          // Dynamic import to avoid SSR issues
          const plyrModule = await import('plyr')
          const PlyrModule = (plyrModule as any).default || plyrModule
          
          const videoEl = videoRef.current
          
          // Make absolutely sure video element doesn't have native controls
          if (videoEl.hasAttribute('controls')) {
            videoEl.removeAttribute('controls')
            console.log('Removed native controls attribute')
          }
          
          // Also remove via property
          if (videoEl.controls) {
            videoEl.controls = false
          }
          
          // Ensure the video element has the correct src before initializing Plyr
          // Check the src attribute (set in JSX) rather than the src property (which Plyr might modify)
          const srcAttribute = videoEl.getAttribute('src')
          const currentSrc = videoEl.src || ''
          // Only set src if it's actually different to avoid triggering reloads
          if ((!srcAttribute || srcAttribute.includes('blank.mp4')) && !currentSrc.includes(videoUrl)) {
            // Set the src attribute if it's missing or blank, but avoid if already set
            console.log('Setting video src attribute to:', videoUrl)
            // Use setAttribute first to avoid triggering load events
            videoEl.setAttribute('src', videoUrl)
            // Only set property if different to avoid reload
            if (videoEl.src !== videoUrl) {
              videoEl.src = videoUrl
            }
          }
          
          console.log('Initializing Plyr on video element:', {
            hasControls: videoEl.hasAttribute('controls'),
            controlsProperty: videoEl.controls,
            srcAttribute: videoEl.getAttribute('src'),
            srcProperty: videoEl.src,
            tagName: videoEl.tagName,
            readyState: videoEl.readyState,
          })
            
            // Initialize Plyr
          const player = new PlyrModule(videoEl, {
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
              hideControls: false, // Keep controls visible when playing
              resetOnEnd: false,
            })

            plyrRef.current = player
          console.log('Plyr initialized successfully', {
            player,
            container: (player as any).elements?.container,
          })

            // Handle time updates from Plyr - use the current onTimeUpdate from closure
            const currentOnTimeUpdate = onTimeUpdate
            if (currentOnTimeUpdate) {
              player.on('timeupdate', () => {
                if (currentOnTimeUpdate && player.currentTime !== undefined) {
                  currentOnTimeUpdate(player.currentTime)
                }
              })
            }
          
          // Log when Plyr is ready
          player.on('ready', () => {
            console.log('Plyr player is ready')
          })
          
          // Log any errors
          player.on('error', (error: any) => {
            console.error('Plyr player error:', error)
          })
          } catch (error) {
            console.error('Error initializing Plyr:', error)
          plyrRef.current = null // Reset on error
        }
      }
    }
    
    const initPlyrPlayer = initPlyrPlayerRef.current

    // Initialize Plyr for HTML5 videos
    useEffect(() => {
      console.log('Plyr useEffect triggered:', {
        hasYoutubeUrl: !!video.youtube_url,
        hasVideoUrl: !!video.video_url,
        status: video.status,
        videoRefExists: !!videoRef.current,
        plyrRefExists: !!plyrRef.current,
      })

      // Only initialize Plyr for uploaded videos (not YouTube)
      // Allow initialization for any status except uploading/processing/transcribing
      const isProcessing = video.status === 'uploading' || video.status === 'processing' || video.status === 'transcribing'
      
      if (video.youtube_url || !video.video_url || isProcessing) {
        console.log('Plyr init skipped - conditions not met:', {
          hasYoutubeUrl: !!video.youtube_url,
          hasVideoUrl: !!video.video_url,
          isProcessing,
        })
        // Clean up if conditions aren't met
        if (plyrRef.current) {
          try {
            plyrRef.current.destroy()
          } catch (e) {
            // Ignore destroy errors
          }
          plyrRef.current = null
        }
        return
      }

      // Destroy existing Plyr instance when video URL changes
      if (plyrRef.current) {
        try {
          plyrRef.current.destroy()
        } catch (e) {
          console.warn('Error destroying Plyr on URL change:', e)
        }
        plyrRef.current = null
      }

      // Wait for video element to be ready, then initialize Plyr
      const timer = setTimeout(() => {
        console.log('Plyr init timer fired:', {
          videoRefExists: !!videoRef.current,
          plyrRefExists: !!plyrRef.current,
        })
        
        if (videoRef.current && !plyrRef.current) {
          // Make sure video element doesn't have native controls
          if (videoRef.current.hasAttribute('controls')) {
            videoRef.current.removeAttribute('controls')
          }
          if (videoRef.current.controls) {
            videoRef.current.controls = false
          }
          
          // Initialize Plyr
          console.log('Calling initPlyrPlayer from useEffect')
          initPlyrPlayer().catch(err => {
            console.error('Failed to initialize Plyr:', err)
          })
        } else {
          console.log('Skipping Plyr init - videoRef:', !!videoRef.current, 'plyrRef:', !!plyrRef.current)
        }
      }, 500)

      return () => {
        clearTimeout(timer)
        if (plyrRef.current) {
          try {
            plyrRef.current.destroy()
          } catch (e) {
            // Ignore destroy errors
          }
          plyrRef.current = null
        }
      }
    }, [video.video_url, video.youtube_url, video.status]) // Removed initPlyrPlayer from deps to prevent infinite loops

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
      // video_url should always be a full URL (CloudFront or S3)
      // Ensure it has https:// protocol (fix for old URLs that might be missing it)
      let videoSrc = video.video_url
      if (!videoSrc.startsWith('http://') && !videoSrc.startsWith('https://')) {
        videoSrc = `https://${videoSrc}`
      }

      // Reset error state when video URL changes and force video reload
      useEffect(() => {
        setVideoError(null)
        setIsLoading(true)
        
        // Force video element to reload when URL changes
        if (videoRef.current) {
          videoRef.current.load()
        }
        
        // Test if the URL is accessible
        const testUrl = async () => {
          try {
            const response = await fetch(videoSrc, { method: 'HEAD', mode: 'no-cors' })
            console.log('Video URL test (HEAD request):', videoSrc)
          } catch (error) {
            console.warn('Video URL test failed (this is normal for CORS):', error)
          }
        }
        testUrl()
        
        // Set a timeout to detect if video never loads (15 seconds)
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current)
        }
        
        loadingTimeoutRef.current = setTimeout(() => {
          console.warn('Video loading timeout after 15 seconds')
          setVideoError('Video is taking too long to load. This could be a network issue, CORS problem, or the file might be inaccessible. Try opening the URL directly in a new tab.')
          setIsLoading(false)
        }, 15000) // 15 second timeout
        
        return () => {
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current)
            loadingTimeoutRef.current = null
          }
        }
      }, [video.video_url, videoSrc])

      return (
        <Card>
          <CardContent className="p-0">
            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black">
            <video
              ref={(el) => {
                videoRef.current = el
                // Ensure video element never has native controls
                if (el) {
                  if (el.hasAttribute('controls')) {
                    el.removeAttribute('controls')
                  }
                  if (el.controls) {
                    el.controls = false
                  }
                }
                // Initialize Plyr when video element is mounted
                // Allow initialization for any status except uploading/processing/transcribing
                const isProcessing = video.status === 'uploading' || video.status === 'processing' || video.status === 'transcribing'
                
                if (el && !plyrRef.current && !isProcessing && !video.youtube_url && video.video_url) {
                  console.log('Video element mounted, scheduling Plyr init from ref callback')
                  // Small delay to ensure element is fully in DOM
                  setTimeout(() => {
                    if (videoRef.current && !plyrRef.current) {
                      console.log('Calling initPlyrPlayer from ref callback')
                      initPlyrPlayer().catch(err => {
                        console.error('Failed to initialize Plyr from ref:', err)
                      })
                    } else {
                      console.log('Ref callback timeout - videoRef:', !!videoRef.current, 'plyrRef:', !!plyrRef.current)
                    }
                  }, 300)
                } else {
                  console.log('Ref callback skipped:', {
                    hasEl: !!el,
                    plyrRefExists: !!plyrRef.current,
                    status: video.status,
                    isProcessing,
                    hasYoutubeUrl: !!video.youtube_url,
                    hasVideoUrl: !!video.video_url,
                  })
                }
              }}
                className="w-full h-full object-contain"
              playsInline
                preload="auto"
              src={videoSrc}
                style={{ display: 'block' }}
                onLoadStart={() => {
                  setIsLoading(true)
                  setVideoError(null)
                  console.log('Video load started:', videoSrc)
                  
                  // Clear any existing timeout
                  if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current)
                  }
                  
                  // Set new timeout
                  loadingTimeoutRef.current = setTimeout(() => {
                    console.warn('Video load timeout - still loading after 15 seconds')
                    setVideoError('Video is taking too long to load. Check: 1) Network connection, 2) CORS settings, 3) File accessibility')
                    setIsLoading(false)
                  }, 15000)
                }}
              onError={(e) => {
                  setIsLoading(false)
                  const videoElement = e.currentTarget
                  let errorMsg = 'Failed to load video'
                  
                  if (videoElement.error) {
                    switch (videoElement.error.code) {
                      case videoElement.error.MEDIA_ERR_ABORTED:
                        errorMsg = 'Video loading was aborted'
                        break
                      case videoElement.error.MEDIA_ERR_NETWORK:
                        errorMsg = 'Network error while loading video. Check CORS settings and URL accessibility.'
                        break
                      case videoElement.error.MEDIA_ERR_DECODE:
                        errorMsg = 'Video codec not supported. The video may use H.265/HEVC codec which is not supported in all browsers.'
                        break
                      case videoElement.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMsg = 'Video format not supported by browser. MP4 with H.264 codec is recommended.'
                        break
                    }
                  }
                  
                  console.error('Video load error:', {
                    error: videoElement.error,
                    code: videoElement.error?.code,
                    message: errorMsg,
                    src: videoSrc,
                  })
                  
                  if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current)
                    loadingTimeoutRef.current = null
                  }
                  
                  setVideoError(errorMsg)
                }}
                onAbort={() => {
                  console.warn('Video load aborted')
                }}
                onLoadedMetadata={() => {
                  console.log('Video metadata loaded:', {
                    duration: videoRef.current?.duration,
                    videoWidth: videoRef.current?.videoWidth,
                    videoHeight: videoRef.current?.videoHeight,
                    src: videoSrc,
                    readyState: videoRef.current?.readyState,
                    networkState: videoRef.current?.networkState,
                  })
                  
                  // Ensure video element doesn't have native controls
                  if (videoRef.current) {
                    if (videoRef.current.hasAttribute('controls')) {
                      videoRef.current.removeAttribute('controls')
                    }
                    if (videoRef.current.controls) {
                      videoRef.current.controls = false
                    }
                    
                    // Ensure Plyr is initialized (especially for AWS videos)
                    // Allow initialization for any status except uploading/processing/transcribing
                    const isProcessing = video.status === 'uploading' || video.status === 'processing' || video.status === 'transcribing'
                    
                    if (!plyrRef.current && !isProcessing && !video.youtube_url && video.video_url) {
                      setTimeout(() => {
                        if (videoRef.current && !plyrRef.current) {
                          console.log('Calling initPlyrPlayer from onLoadedMetadata (AWS video detected)')
                          initPlyrPlayer().catch(err => {
                            console.error('Failed to initialize Plyr from metadata:', err)
                          })
                        }
                      }, 100)
                    }
                  }
                  
                  // Ensure video is ready to play
                  if (videoRef.current && videoRef.current.readyState >= 2) {
                    setIsLoading(false)
                    setVideoError(null)
                    
                    // Don't try to play if Plyr is controlling it
                    if (videoRef.current && videoRef.current.paused && !plyrRef.current) {
                      videoRef.current.play().catch((err) => {
                        console.log('Autoplay prevented (this is normal):', err.message)
                        // Video is still ready, just needs user interaction to play
                      })
                    }
                  }
                }}
                onLoadedData={() => {
                  setIsLoading(false)
                  setVideoError(null)
                  if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current)
                    loadingTimeoutRef.current = null
                  }
                  console.log('Video data loaded successfully')
                }}
                onCanPlay={() => {
                  setIsLoading(false)
                  setVideoError(null)
                  if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current)
                    loadingTimeoutRef.current = null
                  }
                  console.log('Video can play')
                  
                  // Try to play when video is ready (browser may block autoplay)
                  if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch((err) => {
                      console.log('Autoplay prevented (user interaction required):', err.message)
                    })
                  }
                }}
                onCanPlayThrough={() => {
                  setIsLoading(false)
                  setVideoError(null)
                  console.log('Video can play through without buffering')
                  
                  // Video is fully loaded, try to play
                  if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch((err) => {
                      console.log('Autoplay prevented:', err.message)
                    })
                  }
              }}
            >
              Your browser does not support the video tag.
            </video>
              
              {isLoading && !videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="text-center">
                    <p className="text-sm text-white mb-2">Loading video...</p>
                    <p className="text-xs text-gray-400">
                      <a href={videoSrc} target="_blank" rel="noopener noreferrer" className="underline text-blue-400">
                        Open video URL directly
                      </a>
                    </p>
                  </div>
                </div>
              )}
              
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
                  <div className="text-center p-4">
                    <p className="text-sm font-medium text-red-400 mb-2">Video Error</p>
                    <p className="text-xs text-gray-300 mb-4">{videoError}</p>
                    <p className="text-xs text-gray-400 mb-2 break-all">URL: {videoSrc}</p>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setVideoError(null)
                        setIsLoading(true)
                        if (videoRef.current) {
                          // Reset the video element
                          videoRef.current.pause()
                          videoRef.current.currentTime = 0
                          videoRef.current.load()
                          // Try to play after a short delay
                          setTimeout(() => {
                            if (videoRef.current) {
                              videoRef.current.play().catch((err) => {
                                console.warn('Auto-play prevented:', err)
                              })
                            }
                          }, 100)
                        }
                      }}
                      className="text-xs px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
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
