import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { openai } from '@/lib/openai'
import { createServiceClient } from '@/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { videoId } = await req.json()

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get video and segments
    const serviceClient = createServiceClient()
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (video.status !== 'ready') {
      return NextResponse.json(
        { error: 'Video is not ready. Please wait for transcription to complete.' },
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
        { error: 'No transcript available. Please transcribe the video first.' },
        { status: 400 }
      )
    }

    // Combine segments into full transcript
    const transcript = segments.map((s) => s.text).join(' ')

    // Generate summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that creates concise, well-structured summaries of educational video content. Focus on key concepts, main points, and important details.',
        },
        {
          role: 'user',
          content: `Create a comprehensive summary of this video transcript:\n\n${transcript}\n\nFormat the summary with clear sections and bullet points where appropriate.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const summaryContent = completion.choices[0]?.message?.content || ''

    if (!summaryContent) {
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
    }

    // Save or update summary
    const { error: summaryError } = await serviceClient
      .from('summaries')
      .upsert(
        {
          video_id: videoId,
          user_id: user.id,
          content: summaryContent,
        },
        {
          onConflict: 'video_id,user_id',
        }
      )

    if (summaryError) {
      console.error('Error saving summary:', summaryError)
      return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 })
    }

    return NextResponse.json({ success: true, content: summaryContent })
  } catch (error: any) {
    console.error('Error generating summary:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

