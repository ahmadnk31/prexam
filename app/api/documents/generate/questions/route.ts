import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import { generateQuestions } from '@/lib/questions'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, count = 20, regenerate } = await req.json()

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

    // Delete existing questions if regenerating
    if (regenerate) {
      const { error: deleteError } = await serviceClient
        .from('document_questions')
        .delete()
        .eq('document_id', documentId)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Error deleting existing questions:', deleteError)
      }
    }

    // Split text into chunks for processing
    const chunkSize = 10000
    const chunks: string[] = []
    for (let i = 0; i < documentText.length; i += chunkSize) {
      chunks.push(documentText.slice(i, i + chunkSize))
    }

    // Get document language (default to 'en' if not set)
    const documentLanguage = document.language || 'en'

    // Generate questions from all chunks
    const allQuestions: Array<{
      type: string
      question: string
      options: string[] | null
      correct_answer: string
      explanation: string | null
    }> = []
    
    for (const chunk of chunks) {
      const questions = await generateQuestions([chunk], count, documentLanguage)
      allQuestions.push(...questions)
    }

    // Limit to requested count
    const questions = allQuestions.slice(0, count)

    // Store questions in database
    const questionInserts = questions.map((q) => ({
      document_id: documentId,
      user_id: user.id,
      type: q.type,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
    }))

    const { error: insertError } = await serviceClient
      .from('document_questions')
      .insert(questionInserts)

    if (insertError) {
      console.error('Error inserting questions:', insertError)
      return NextResponse.json(
        { error: 'Failed to store questions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: questions.length,
      questions,
    })
  } catch (error) {
    console.error('Question generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

