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

    const { videoId } = await req.json()

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

    // Delete existing flashcards for this video (for regeneration)
    const { error: deleteError } = await serviceClient
      .from('flashcards')
      .delete()
      .eq('video_id', videoId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting existing flashcards:', deleteError)
      // Continue anyway - might be first generation
    }

    // Generate flashcards
    const flashcards = await generateFlashcards(transcriptTexts)

    // Store flashcards in database
    const flashcardInserts = flashcards.map((fc) => ({
      video_id: videoId,
      user_id: user.id,
      front: fc.front,
      back: fc.back,
    }))

    const { error: insertError } = await serviceClient
      .from('flashcards')
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

