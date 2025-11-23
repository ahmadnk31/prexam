import { createClient } from '@/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DocumentQuizComponent from '@/components/document-quiz-component'

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

async function getQuestions(documentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('document_questions')
    .select('*')
    .eq('document_id', documentId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching questions:', error)
    return []
  }

  return data || []
}

export default async function DocumentQuizPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  const questions = await getQuestions(id)

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold text-[#4B3F72]">Take Quiz</h1>
        <div className="rounded-lg border border-purple-200 p-8 text-center">
          <p className="mb-4 text-gray-600">
            No questions available. Generate them from the document page.
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
        <h1 className="text-3xl font-bold text-[#4B3F72]">Take Quiz</h1>
        <a
          href={`/dashboard/documents/${id}`}
          className="text-sm text-[#4B3F72] hover:underline font-medium"
        >
          Back to document
        </a>
      </div>
      <DocumentQuizComponent questions={questions} documentId={id} />
    </div>
  )
}

