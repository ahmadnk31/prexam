import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'
import { parseWhisperVerboseResponse } from '@/lib/transcript'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoId, transcript, source } = await req.json()

    if (!videoId || !transcript) {
      return NextResponse.json(
        { error: 'Video ID and transcript are required' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Verify video ownership
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

    // Parse transcript into segments (simple approach - split by sentences)
    const sentences = transcript.split(/[.!?]+/).filter((s: string) => s.trim().length > 0)
    const estimatedDuration = video.duration || sentences.length * 3 // Rough estimate: 3 seconds per sentence
    
    const segments = sentences.map((sentence, index) => {
      const startTime = (index * estimatedDuration) / sentences.length
      const endTime = ((index + 1) * estimatedDuration) / sentences.length
      return {
        text: sentence.trim(),
        start: startTime,
        end: endTime,
      }
    })

    // If no segments, create one segment with full transcript
    if (segments.length === 0) {
      segments.push({
        text: transcript,
        start: 0,
        end: estimatedDuration || 60,
      })
    }

    // Delete existing segments
    await serviceClient
      .from('video_segments')
      .delete()
      .eq('video_id', videoId)

    // Store segments in database
    const segmentInserts = segments.map((seg, index) => ({
      video_id: videoId,
      segment_index: index,
      start_time: seg.start,
      end_time: seg.end,
      text: seg.text,
    }))

    const { error: segmentsError } = await serviceClient
      .from('video_segments')
      .insert(segmentInserts)

    if (segmentsError) {
      console.error('Error inserting segments:', segmentsError)
      return NextResponse.json(
        { error: 'Failed to store transcript segments' },
        { status: 500 }
      )
    }

    // Update video status to ready
    await serviceClient
      .from('videos')
      .update({ 
        status: 'ready',
        duration: estimatedDuration,
      })
      .eq('id', videoId)

    return NextResponse.json({
      success: true,
      videoId,
      segmentsCount: segments.length,
    })
  } catch (error: any) {
    console.error('Finalize transcription error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

