import { NextRequest, NextResponse } from 'next/server'
import { processDocument } from '@/lib/document-processor'

export async function POST(req: NextRequest) {
  try {
    const { documentId } = await req.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    const result = await processDocument(documentId, { waitForCompletion: true })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Document processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process document' },
      { status: 500 }
    )
  }
}

