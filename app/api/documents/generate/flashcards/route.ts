import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import { generateFlashcards } from '@/lib/flashcards'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, regenerate } = await req.json()

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

    // Get document text (from chunks or extracted_text)
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

    // Delete existing flashcards if regenerating
    if (regenerate) {
      const { error: deleteError } = await serviceClient
        .from('document_flashcards')
        .delete()
        .eq('document_id', documentId)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Error deleting existing flashcards:', deleteError)
      }
    }

    // Split text into chunks for processing (max 10000 chars per chunk)
    const chunkSize = 10000
    const chunks: string[] = []
    for (let i = 0; i < documentText.length; i += chunkSize) {
      chunks.push(documentText.slice(i, i + chunkSize))
    }

    // Generate flashcards from all chunks
    const allFlashcards: Array<{ front: string; back: string }> = []
    for (const chunk of chunks) {
      const flashcards = await generateFlashcards([chunk])
      allFlashcards.push(...flashcards)
    }

    // Limit to 50 flashcards max
    const flashcards = allFlashcards.slice(0, 50)

    // Store flashcards in database
    const flashcardInserts = flashcards.map((fc) => ({
      document_id: documentId,
      user_id: user.id,
      front: fc.front,
      back: fc.back,
    }))

    const { error: insertError } = await serviceClient
      .from('document_flashcards')
      .insert(flashcardInserts)

    if (insertError) {
      console.error('Error inserting flashcards:', insertError)
      return NextResponse.json(
        { error: 'Failed to store flashcards' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: flashcards.length,
      flashcards,
    })
  } catch (error) {
    console.error('Flashcard generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

