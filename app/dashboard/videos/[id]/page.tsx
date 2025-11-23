import { createClient } from '@/supabase/server'
import { notFound, redirect } from 'next/navigation'
import VideoPlayer, { VideoPlayerRef } from '@/components/video-player'
import TranscriptPanel from '@/components/transcript-panel'
import AIToolsPanel from '@/components/ai-tools-panel'
import { Card, CardContent } from '@/components/ui/card'
import { transcribeVideo } from '@/lib/transcribe'
import VideoTranscriptSync from '@/components/video-transcript-sync'
import ResizableLayout from '@/components/resizable-layout'

async function getVideo(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: video, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching video:', error)
    return null
  }

  if (!video) {
    console.error('Video not found:', id)
    return null
  }

  return video
}

async function getSegments(videoId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('video_segments')
    .select('*')
    .eq('video_id', videoId)
    .order('segment_index', { ascending: true })

  if (error) {
    console.error('Error fetching segments:', error)
    return []
  }

  return data || []
}

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const video = await getVideo(id)

  if (!video) {
    notFound()
  }

  const segments = video.status === 'ready' ? await getSegments(id) : []

  // Debug: Log video data
  console.log('Video data:', {
    id: video.id,
    title: video.title,
    status: video.status,
    youtube_url: video.youtube_url,
    video_url: video.video_url,
  })

  return (
    <div className="mx-auto max-w-[95vw] px-2 sm:px-4 py-4 sm:py-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold break-words flex-1 text-[#4B3F72]">{video.title}</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`rounded-full px-4 py-1.5 text-xs font-semibold border ${
              video.status === 'ready'
                ? 'bg-green-50 text-green-700 border-green-200'
                : video.status === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
            }`}
          >
            {video.status}
          </span>
        </div>
      </div>

      <div className="h-auto md:h-[calc(100vh-12rem)] lg:min-h-[600px] lg:max-h-[calc(100vh-12rem)]">
        <ResizableLayout
          defaultLeftSize={65}
          minLeftSize={40}
          minRightSize={25}
          leftPanel={
            <VideoTranscriptSync
              video={video}
              segments={segments}
              videoId={id}
            />
          }
          rightPanel={
            <div className="h-full">
              {video.status === 'ready' && (
                <AIToolsPanel videoId={id} />
              )}
              {video.youtube_url && video.status === 'error' && (
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          ⚠️ YouTube Transcription Unavailable
                        </p>
                        <p className="text-xs text-gray-600 mb-2">
                          YouTube downloads are unreliable due to frequent API changes. The download library cannot extract the video due to YouTube's encryption updates.
                        </p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                          <p className="text-xs font-medium text-yellow-800 mb-1">
                            💡 Recommended Solution
                          </p>
                          <p className="text-xs text-yellow-700">
                            Download the video from YouTube and upload the file directly. This will enable reliable transcription and flashcard generation.
                          </p>
                        </div>
                      </div>
                      <form action={async () => {
                        'use server'
                        try {
                          await transcribeVideo(id)
                          redirect(`/dashboard/videos/${id}`)
                        } catch (error: any) {
                          console.error('Transcription error:', error)
                          redirect(`/dashboard/videos/${id}`)
                        }
                      }}>
                        <button
                          type="submit"
                          className="w-full rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 mt-3"
                        >
                          Retry (May Still Fail)
                        </button>
                      </form>
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
                    <form action={async () => {
                      'use server'
                      try {
                        await transcribeVideo(id)
                        redirect(`/dashboard/videos/${id}`)
                      } catch (error: any) {
                        console.error('Transcription error:', error)
                        // Still redirect to show error status
                        redirect(`/dashboard/videos/${id}`)
                      }
                    }}>
                      <button
                        type="submit"
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        {video.status === 'error' ? 'Retry Transcription' : 'Manually Trigger Transcription'}
                      </button>
                    </form>
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
    </div>
  )
}

