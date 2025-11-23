import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { openai } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const { text, action, videoId } = await req.json()

    if (!text || !action) {
      return NextResponse.json(
        { error: 'Text and action are required' },
        { status: 400 }
      )
    }

    if (text.length < 10) {
      return NextResponse.json(
        { error: 'Selected text is too short. Please select at least 10 characters.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the video or document
    if (videoId) {
      // Check if it's a video or document
      const { data: video } = await supabase
        .from('videos')
        .select('user_id')
        .eq('id', videoId)
        .single()

      if (video && video.user_id === user.id) {
        // It's a video, ownership verified
      } else {
        // Check if it's a document
        const { data: document } = await supabase
          .from('documents')
          .select('user_id')
          .eq('id', videoId)
          .single()

        if (!document || document.user_id !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
      }
    }

    // Generate prompt based on action
    let systemPrompt = ''
    let userPrompt = ''

    if (action === 'summarize') {
      systemPrompt =
        'You are a helpful assistant that creates concise summaries of educational content. Focus on key points and main ideas.'
      userPrompt = `Summarize the following text in a clear and concise way:\n\n${text}`
    } else if (action === 'explain') {
      systemPrompt =
        'You are a helpful educational assistant that explains concepts clearly and in detail. Break down complex ideas into simpler terms.'
      userPrompt = `Explain the following text in detail, making it easy to understand:\n\n${text}`
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const result = completion.choices[0]?.message?.content || ''

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      )
    }

    return NextResponse.json({ result })
  } catch (error: any) {
    console.error('Error analyzing text:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze text' },
      { status: 500 }
    )
  }
}

