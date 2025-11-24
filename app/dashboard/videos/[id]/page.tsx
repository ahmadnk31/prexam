import { createClient } from '@/supabase/server'
import { notFound } from 'next/navigation'
import VideoPageClient from '@/components/video-page-client'
import type { Metadata } from 'next'

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      title: 'Video',
    }
  }

  const { data: video } = await supabase
    .from('videos')
    .select('title')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!video) {
    return {
      title: 'Video Not Found',
    }
  }

  return {
    title: video.title,
    description: `Study ${video.title} with AI-generated flashcards, quizzes, and transcript. Transform your video into interactive study materials.`,
    robots: {
      index: false,
      follow: false,
    },
  }
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
    segmentsCount: segments.length,
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

      <VideoPageClient
        initialVideo={video}
        initialSegments={segments}
        videoId={id}
      />
    </div>
  )
}

