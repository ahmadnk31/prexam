import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import { openai } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await req.json()

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Get document and verify ownership
    const { data: document, error: documentError } = await serviceClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (documentError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (document.status !== 'ready') {
      return NextResponse.json(
        { error: 'Document not ready' },
        { status: 400 }
      )
    }

    // Get document text
    let documentText = ''
    if (document.extracted_text) {
      documentText = document.extracted_text
    } else {
      const { data: chunks, error: chunksError } = await serviceClient
        .from('document_chunks')
        .select('content')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true })

      if (chunksError || !chunks || chunks.length === 0) {
        return NextResponse.json(
          { error: 'No document content found' },
          { status: 404 }
        )
      }

      documentText = chunks.map((c) => c.content).join('\n\n')
    }

    if (!documentText || documentText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Document has no extractable text' },
        { status: 400 }
      )
    }

    // Truncate text if too long (max 100k chars for summary)
    const maxLength = 100000
    const textToSummarize = documentText.length > maxLength
      ? documentText.slice(0, maxLength) + '\n\n[Content truncated...]'
      : documentText

    // Generate summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates comprehensive summaries of documents. Create a well-structured summary with key points, main ideas, and important details.',
        },
        {
          role: 'user',
          content: `Please create a comprehensive summary of the following document:\n\n${textToSummarize}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const summaryContent = completion.choices[0]?.message?.content || ''

    if (!summaryContent) {
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: 500 }
      )
    }

    // Store or update summary
    const { error: upsertError } = await serviceClient
      .from('summaries')
      .upsert(
        {
          document_id: documentId,
          video_id: null,
          user_id: user.id,
          content: summaryContent,
        },
        {
          onConflict: 'document_id,user_id',
        }
      )

    if (upsertError) {
      console.error('Error storing summary:', upsertError)
      return NextResponse.json(
        { error: 'Failed to store summary' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      content: summaryContent,
    })
  } catch (error: any) {
    console.error('Summary generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

