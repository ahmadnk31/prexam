import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'
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

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const source = formData.get('source') as string
    const mode = (formData.get('mode') as string) || 'general'
    const existingVideoId = formData.get('videoId') as string | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    // Check file size (must be > 0 and have minimum size for valid audio)
    if (audioFile.size === 0) {
      return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 })
    }

    // Skip very small chunks (likely incomplete)
    // Minimum ~10KB for a valid audio chunk that OpenAI can process
    // WebM chunks need to be large enough to contain a complete audio frame
    if (audioFile.size < 10240) {
      console.log('Skipping chunk - too small:', audioFile.size, 'bytes')
      return NextResponse.json({ 
        success: true, 
        videoId: existingVideoId || null,
        transcript: '' 
      })
    }

    // Get the file content as a buffer to validate format
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Detect actual file format by checking magic bytes
    let detectedFormat: string | null = null
    let detectedMimeType = 'audio/wav' // Default to WAV for better compatibility
    let detectedExtension = 'wav'
    
    if (buffer.length >= 4) {
      const header = buffer.subarray(0, 4)
      
      // WAV format: starts with "RIFF" (0x52 0x49 0x46 0x46) - prefer this
      if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
        detectedFormat = 'wav'
        detectedMimeType = 'audio/wav'
        detectedExtension = 'wav'
      }
      // WebM format: starts with 0x1a 0x45 0xdf 0xa3
      // MediaRecorder webm chunks are often incomplete fragments - reject them
      // Client should convert to WAV before sending
      else if (header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) {
        console.log('Rejecting webm chunk - should be converted to WAV on client side')
        return NextResponse.json({ 
          success: true, 
          videoId: existingVideoId || null,
          transcript: '' 
        })
      }
      // MP3 format: starts with 0xff 0xfb or 0xff 0xf3
      else if (header[0] === 0xff && (header[1] === 0xfb || header[1] === 0xf3)) {
        detectedFormat = 'mp3'
        detectedMimeType = 'audio/mpeg'
        detectedExtension = 'mp3'
      }
      // OGG format: starts with "OggS" (0x4f 0x67 0x67 0x53)
      else if (header[0] === 0x4f && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) {
        detectedFormat = 'ogg'
        detectedMimeType = 'audio/ogg'
        detectedExtension = 'ogg'
      }
      // If it's webm type but we can't validate it, reject it
      else if (audioFile.type?.includes('webm')) {
        console.log('Rejecting unvalidated webm chunk')
        return NextResponse.json({ 
          success: true, 
          videoId: existingVideoId || null,
          transcript: '' 
        })
      }
    }
    
    // Create a properly formatted File object
    const fileName = `audio.${detectedExtension}`
    const processedFile = new File([arrayBuffer], fileName, { 
      type: detectedMimeType
    })
    
    // Log for debugging
    console.log('Processing audio chunk:', {
      originalSize: audioFile.size,
      detectedFormat,
      mimeType: detectedMimeType,
      extension: detectedExtension,
      fileName: processedFile.name,
      originalType: audioFile.type
    })

    const serviceClient = createServiceClient()
    let videoId = existingVideoId

    // Create video record if it doesn't exist
    if (!videoId) {
      const modeNames: Record<string, string> = {
        'interview': 'Interview',
        'meeting': 'Meeting',
        'lecture': 'Lecture',
        'podcast': 'Podcast',
        'quick-notes': 'Quick Notes',
        'general': 'General'
      }
      const modeName = modeNames[mode] || 'General'
      const title = `${modeName} - ${source === 'microphone' ? 'Microphone' : 'System'} Recording - ${new Date().toLocaleString()}`
      
      const { data: video, error: videoError } = await serviceClient
        .from('videos')
        .insert({
          title,
          user_id: user.id,
          status: 'transcribing',
          description: `Real-time audio recording from ${source} (${modeName} mode)`,
        })
        .select()
        .single()

      if (videoError || !video) {
        console.error('Error creating video record:', videoError)
        return NextResponse.json(
          { error: 'Failed to create video record' },
          { status: 500 }
        )
      }

      videoId = video.id
    }

    // Transcribe with Whisper
    let transcription
    try {
      console.log('Sending to OpenAI Whisper:', {
        fileName: processedFile.name,
        fileSize: processedFile.size,
        fileType: processedFile.type,
        detectedFormat
      })
      
      // Mode-specific prompts for better transcription quality
      const modePrompts: Record<string, string> = {
        'interview': 'This is an interview conversation between two people. Transcribe clearly with proper punctuation.',
        'meeting': 'This is a meeting with multiple speakers. Transcribe all speakers clearly.',
        'lecture': 'This is an educational lecture or presentation. Transcribe with proper structure and formatting.',
        'podcast': 'This is a podcast or long-form conversation. Transcribe naturally with proper punctuation.',
        'quick-notes': 'This is a quick voice note. Transcribe concisely.',
        'general': 'Transcribe this audio clearly.'
      }
      
      const prompt = modePrompts[mode] || modePrompts['general']
      
      transcription = await openai.audio.transcriptions.create({
        file: processedFile,
        model: 'whisper-1',
        response_format: 'text', // Simple text for real-time
        language: undefined,
        prompt: prompt, // Add mode-specific prompt for better accuracy
      })
    } catch (openaiError: any) {
      console.error('OpenAI API error:', {
        message: openaiError.message,
        fileName: processedFile.name,
        fileSize: processedFile.size,
        fileType: processedFile.type,
        detectedFormat,
        error: openaiError
      })
      
      // If it's a format error and we detected webm, try with a different approach
      if (openaiError.message?.includes('Invalid file format') && detectedFormat === 'webm') {
        // WebM chunks might be incomplete - skip this chunk
        console.log('Skipping invalid webm chunk, will retry with next chunk')
        return NextResponse.json({
          success: true,
          videoId: existingVideoId || null,
          transcript: '' // Return empty transcript for invalid chunks
        })
      }
      
      return NextResponse.json(
        {
          error: 'Transcription failed',
          message: openaiError.message || 'Unknown error',
        },
        { status: 500 }
      )
    }

    const transcriptText = typeof transcription === 'string' ? transcription : transcription.text || ''

    // Store transcript chunk (we'll accumulate segments later)
    // For now, just return the transcript
    return NextResponse.json({
      success: true,
      videoId,
      transcript: transcriptText,
    })
  } catch (error: any) {
    console.error('Real-time audio transcription error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

