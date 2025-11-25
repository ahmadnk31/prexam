import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'
import { openai } from '@/lib/openai'
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

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const title = formData.get('title') as string
    const source = formData.get('source') as string // 'microphone' or 'system'

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Create video record
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .insert({
        title,
        user_id: user.id,
        status: 'transcribing',
        description: `Audio recording from ${source}`,
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

    // Upload audio to S3
    const { uploadToS3, getPublicUrl } = await import('@/lib/s3')
    const fileName = `${video.id}_audio.${audioFile.name.split('.').pop() || 'webm'}`
    
    let publicUrl: string
    try {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
      const s3Key = await uploadToS3('videos', user.id, fileName, audioBuffer, audioFile.type)
      publicUrl = getPublicUrl('videos', s3Key)
    } catch (uploadError: any) {
      console.error('Error uploading audio to S3:', uploadError)
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', video.id)
      return NextResponse.json(
        { error: 'Failed to upload audio file' },
        { status: 500 }
      )
    }

    // Update video with audio URL
    await serviceClient
      .from('videos')
      .update({ video_url: publicUrl })
      .eq('id', video.id)
      .eq('id', video.id)

    // Transcribe with Whisper
    let transcription
    try {
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: undefined,
      })
    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError)
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', video.id)
      return NextResponse.json(
        {
          error: 'Transcription failed',
          message: openaiError.message || 'Unknown error',
        },
        { status: 500 }
      )
    }

    const transcriptText = transcription.text || ''
    const segments = parseWhisperVerboseResponse(transcription)

    if (segments.length === 0 && transcriptText) {
      const duration = (transcription as any).duration || 0
      segments.push({
        text: transcriptText,
        start: 0,
        end: duration,
      })
    }

    // Store segments in database
    const segmentInserts = segments.map((seg, index) => ({
      video_id: video.id,
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
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', video.id)
      return NextResponse.json(
        { error: 'Failed to store transcript segments' },
        { status: 500 }
      )
    }

    // Update video status to ready
    await serviceClient
      .from('videos')
      .update({ status: 'ready' })
      .eq('id', video.id)

    return NextResponse.json({
      success: true,
      videoId: video.id,
      transcript: transcriptText,
      segmentsCount: segments.length,
    })
  } catch (error: any) {
    console.error('Audio transcription error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

