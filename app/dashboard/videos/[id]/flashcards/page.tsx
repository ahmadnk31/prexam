import { createClient } from '@/supabase/server'
import { notFound, redirect } from 'next/navigation'
import FlashcardStudy from '@/components/flashcard-study'

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

  if (error || !video) {
    return null
  }

  return video
}

async function getFlashcards(videoId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('video_id', videoId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching flashcards:', error)
    return []
  }

  return data || []
}

export default async function FlashcardsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const video = await getVideo(id)

  if (!video) {
    notFound()
  }

  const flashcards = await getFlashcards(id)

  if (flashcards.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Study Flashcards</h1>
        <div className="rounded-lg border p-8 text-center">
          <p className="mb-4 text-gray-600">
            No flashcards available. Generate them from the video page.
          </p>
          <a
            href={`/dashboard/videos/${id}`}
            className="text-blue-600 hover:underline"
          >
            Go to video page
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Study Flashcards</h1>
        <a
          href={`/dashboard/videos/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to video
        </a>
      </div>
      <FlashcardStudy flashcards={flashcards} videoId={id} />
    </div>
  )
}

