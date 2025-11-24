import { createClient } from '@/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DocumentPageClient from '@/components/document-page-client'
import type { Metadata } from 'next'

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

  if (error) {
    console.error('Error fetching document:', error)
    return null
  }

  if (!document) {
    console.error('Document not found:', id)
    return null
  }

  return document
}

async function getDocumentChunks(documentId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('document_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error) {
    console.error('Error fetching chunks:', error)
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
      title: 'Document',
    }
  }

  const { data: document } = await supabase
    .from('documents')
    .select('title')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!document) {
    return {
      title: 'Document Not Found',
    }
  }

  return {
    title: document.title,
    description: `Study ${document.title} with AI-generated flashcards, quizzes, and summaries. Transform your document into interactive study materials.`,
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  const chunks = document.status === 'ready' ? await getDocumentChunks(id) : []

  return (
    <DocumentPageClient
      initialDocument={document}
      initialChunks={chunks}
              documentId={id}
            />
  )
}

