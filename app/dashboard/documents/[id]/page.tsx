import { createClient } from '@/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DocumentPageClient from '@/components/document-page-client'

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

