import { createClient } from '@/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DocumentViewer from '@/components/document-viewer'
import DocumentAIToolsPanel from '@/components/document-ai-tools-panel'
import ResizableLayout from '@/components/resizable-layout'

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
    <div className="mx-auto max-w-[95vw] px-2 py-8 md:px-4">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold break-words flex-1 text-[#4B3F72]">{document.title}</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-purple-600/70 font-medium uppercase">{document.file_type}</span>
          <span
            className={`rounded-full px-4 py-1.5 text-xs font-semibold border ${
              document.status === 'ready'
                ? 'bg-green-50 text-green-700 border-green-200'
                : document.status === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
            }`}
          >
            {document.status}
          </span>
        </div>
      </div>

      <div className="h-[calc(100vh-12rem)] min-h-[600px] max-h-[calc(100vh-12rem)]">
        <ResizableLayout
          defaultLeftSize={65}
          minLeftSize={40}
          minRightSize={25}
          leftPanel={
            <DocumentViewer
              document={document}
              chunks={chunks}
              documentId={id}
            />
          }
          rightPanel={
            <div className="h-full">
              {document.status === 'ready' && (
                <DocumentAIToolsPanel documentId={id} />
              )}
              {(document.status === 'processing' || document.status === 'uploading') && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-purple-700/70 font-medium mb-4">
                      {document.status === 'uploading' && 'Document is being uploaded...'}
                      {document.status === 'processing' && 'Extracting text from document...'}
                    </p>
                    <div className="animate-pulse text-[#4B3F72]">Processing...</div>
                  </div>
                </div>
              )}
              {document.status === 'error' && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-red-700 font-medium mb-4">
                      Error processing document
                    </p>
                    <p className="text-xs text-red-600/70">
                      Please try uploading again or contact support.
                    </p>
                  </div>
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  )
}

