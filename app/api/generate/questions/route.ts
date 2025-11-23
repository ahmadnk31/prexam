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

    const { videoId, count = 20 } = await req.json()

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID required' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Get video and verify ownership
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    if (video.status !== 'ready') {
      return NextResponse.json(
        { error: 'Video transcription not ready' },
        { status: 400 }
      )
    }

    // Get transcript segments
    const { data: segments, error: segmentsError } = await serviceClient
      .from('video_segments')
      .select('text')
      .eq('video_id', videoId)
      .order('segment_index', { ascending: true })

    if (segmentsError || !segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'No transcript segments found' },
        { status: 404 }
      )
    }

    const transcriptTexts = segments.map((s) => s.text)

    // Delete existing questions for this video (for regeneration)
    const { error: deleteError } = await serviceClient
      .from('questions')
      .delete()
      .eq('video_id', videoId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting existing questions:', deleteError)
      // Continue anyway - might be first generation
    }

    // Generate questions
    const questions = await generateQuestions(transcriptTexts, count)

    // Store questions in database
    const questionInserts = questions.map((q) => ({
      video_id: videoId,
      user_id: user.id,
      type: q.type,
      question: q.question,
      options: q.options || null,
      correct_answer: q.correct_answer,
      explanation: q.explanation || null,
    }))

    const { error: insertError } = await serviceClient
      .from('questions')
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

