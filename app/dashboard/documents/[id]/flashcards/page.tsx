import { createClient } from '@/supabase/server'
import { notFound, redirect } from 'next/navigation'
import FlashcardStudy from '@/components/flashcard-study'

async function getDocument(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: document, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !document) {
    return null
  }

  return document
}

async function getFlashcards(documentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('document_flashcards')
    .select('*')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching flashcards:', error)
    return []
  }

  return data || []
}

export default async function DocumentFlashcardsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  const flashcards = await getFlashcards(id)

  if (flashcards.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold text-[#4B3F72]">Study Flashcards</h1>
        <div className="rounded-lg border border-purple-200 p-8 text-center">
          <p className="mb-4 text-gray-600">
            No flashcards available. Generate them from the document page.
          </p>
          <a
            href={`/dashboard/documents/${id}`}
            className="text-[#4B3F72] hover:underline font-medium"
          >
            Go to document page
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#4B3F72]">Study Flashcards</h1>
        <a
          href={`/dashboard/documents/${id}`}
          className="text-sm text-[#4B3F72] hover:underline font-medium"
        >
          Back to document
        </a>
      </div>
      <FlashcardStudy flashcards={flashcards} videoId={id} isDocument={true} />
    </div>
  )
}

