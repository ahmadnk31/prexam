'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/supabase/client'
import DocumentViewer from '@/components/document-viewer'
import DocumentAIToolsPanel from '@/components/document-ai-tools-panel'
import ResizableLayout from '@/components/resizable-layout'

interface Document {
  id: string
  title: string
  file_type: string
  status: string
  extracted_text?: string | null
  page_count?: number | null
}

interface DocumentChunk {
  id: string
  chunk_index: number
  content: string
  page_number: number | null
}

interface DocumentPageClientProps {
  initialDocument: Document
  initialChunks: DocumentChunk[]
  documentId: string
}

export default function DocumentPageClient({
  initialDocument,
  initialChunks,
  documentId,
}: DocumentPageClientProps) {
  const [document, setDocument] = useState<Document>(initialDocument)
  const [chunks, setChunks] = useState<DocumentChunk[]>(initialChunks)
  const [isPolling, setIsPolling] = useState(initialDocument.status === 'processing' || initialDocument.status === 'uploading')

  useEffect(() => {
    if (!isPolling) return

    const supabase = createClient()
    let pollInterval: NodeJS.Timeout

    const pollDocument = async () => {
      try {
        const { data: updatedDocument, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single()

        if (error) {
          console.error('Error polling document:', error)
          return
        }

        if (updatedDocument) {
          const previousStatus = document.status
          setDocument(updatedDocument)

          // If status changed to ready, fetch chunks and stop polling
          if (updatedDocument.status === 'ready' && previousStatus !== 'ready') {
            const { data: updatedChunks, error: chunksError } = await supabase
              .from('document_chunks')
              .select('*')
              .eq('document_id', documentId)
              .order('chunk_index', { ascending: true })

            if (!chunksError && updatedChunks) {
              setChunks(updatedChunks)
            }
            setIsPolling(false)
          } else if (updatedDocument.status === 'error') {
            setIsPolling(false)
          }
        }
      } catch (error) {
        console.error('Error in poll:', error)
      }
    }

    // Poll immediately, then every 2 seconds
    pollDocument()
    pollInterval = setInterval(pollDocument, 2000)

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [documentId, isPolling])

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
              documentId={documentId}
            />
          }
          rightPanel={
            <div className="h-full">
              {document.status === 'ready' && (
                <DocumentAIToolsPanel documentId={documentId} />
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

