// IMPORTANT: Import polyfills FIRST before any other imports
// This ensures DOMMatrix and other DOM APIs are available before pdfjs-dist is loaded
import '@/lib/pdfjs-polyfills'

import { NextRequest, NextResponse } from 'next/server'
import { processDocumentAction } from '@/lib/process-document'
import { createServiceClient } from '@/supabase/service'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large documents

export async function POST(req: NextRequest) {
  try {
    const { documentId } = await req.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Update status to processing before starting
    await serviceClient
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    console.log('Starting document processing (retry):', documentId)

    try {
      const result = await processDocumentAction(documentId)
      console.log('Document processing completed:', result)
      return NextResponse.json(result)
    } catch (processingError: any) {
      console.error('Document processing failed:', {
        documentId,
        error: processingError.message,
        stack: processingError.stack,
      })

      // Update status to error
      await serviceClient
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)

      return NextResponse.json(
        { 
          error: 'Failed to process document',
          message: processingError.message || 'Unknown error',
          details: 'Check server logs for more information'
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Document processing route error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process document',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

