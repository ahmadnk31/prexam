import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { openai } from '@/lib/openai'
import { detectLanguage } from '@/lib/language-detection'

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

    // Try to get language from document if videoId is provided
    // Note: videoId parameter can be either a video ID or document ID
    let documentLanguage: string | null = null
    if (videoId) {
      try {
        // First check if it's a document (documents are more common for text selection)
        // Try to select language, but handle gracefully if column doesn't exist
        let { data: document, error: documentError } = await supabase
          .from('documents')
          .select('user_id, language')
          .eq('id', videoId)
          .single()
        
        // If error is due to missing language column, retry without it
        if (documentError && documentError.code === '42703' && documentError.message?.includes('language')) {
          const retryResult = await supabase
            .from('documents')
            .select('user_id')
            .eq('id', videoId)
            .single()
          // Type assertion: retry result doesn't have language, but we'll handle it
          document = retryResult.data as { user_id: string; language?: string } | null
          documentError = retryResult.error
        }

        if (!documentError && document) {
          // Verify ownership for documents
          if (document.user_id === user.id) {
            // Language might not exist if we retried without it
            documentLanguage = (document as any).language || null
          } else {
            // User doesn't own this document
            console.error('Unauthorized: User does not own document', { 
              userId: user.id, 
              documentUserId: document.user_id, 
              documentId: videoId 
            })
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
          }
        } else {
          // Document query failed or not found - check error code
          if (documentError) {
            if (documentError.code === 'PGRST116') {
              // Not found - check if it's a video
            } else {
              // Other error - log it
              console.error('Error fetching document:', { 
                error: documentError, 
                code: documentError.code, 
                message: documentError.message,
                documentId: videoId,
                userId: user.id
              })
            }
          }
          
          // Check if it's a video
          const { data: video, error: videoError } = await supabase
            .from('videos')
            .select('user_id')
            .eq('id', videoId)
            .single()

          if (!videoError && video) {
            // Verify ownership for videos
            if (video.user_id !== user.id) {
              console.error('Unauthorized: User does not own video', { 
                userId: user.id, 
                videoUserId: video.user_id, 
                videoId 
              })
              return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
            // It's a video, ownership verified (no language from video)
          } else if (videoError && videoError.code !== 'PGRST116') {
            // PGRST116 is "not found" which is fine, but other errors should be logged
            console.error('Error fetching video:', { 
              error: videoError, 
              code: videoError.code, 
              message: videoError.message,
              videoId,
              userId: user.id
            })
          }
          // If both queries returned PGRST116 (not found), we'll proceed without language detection
          // This allows text analysis to work even if the ID is invalid
        }
      } catch (error) {
        console.error('Unexpected error checking ownership:', error)
        // If there's an unexpected error, we'll still proceed but without language detection
        // This allows the feature to work even if there's a temporary DB issue
      }
    }

    // Detect language of the selected text (or use document language if available)
    let detectedLanguage = documentLanguage || 'en'
    if (!documentLanguage) {
      try {
        detectedLanguage = await detectLanguage(text)
      } catch (error) {
        console.error('Error detecting language, defaulting to English:', error)
        detectedLanguage = 'en'
      }
    }

    const languageInstruction = detectedLanguage !== 'en'
      ? ` Respond in the same language as the text (language code: ${detectedLanguage}).`
      : ''

    // Generate prompt based on action
    let systemPrompt = ''
    let userPrompt = ''

    if (action === 'summarize') {
      systemPrompt =
        `You are a helpful assistant that creates concise summaries of educational content. Focus on key points and main ideas.${languageInstruction}`
      userPrompt = `Summarize the following text in a clear and concise way:\n\n${text}`
    } else if (action === 'explain') {
      systemPrompt =
        `You are a helpful educational assistant that explains concepts clearly and in detail. Break down complex ideas into simpler terms.${languageInstruction}`
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


