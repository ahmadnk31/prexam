import { createServiceClient } from '@/supabase/service'
import { openai } from '@/lib/openai'
import { parseWhisperVerboseResponse } from '@/lib/transcript'
import ytdl from 'ytdl-core'

export async function transcribeVideo(videoId: string) {
  const serviceClient = createServiceClient()

  // Get video
  const { data: video, error: videoError } = await serviceClient
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single()

  if (videoError || !video) {
    console.error('Video not found:', videoId, videoError)
    throw new Error('Video not found')
  }

  console.log('Starting transcription for video:', videoId, 'Type:', video.youtube_url ? 'YouTube' : 'Uploaded')

  // Update status to transcribing
  await serviceClient
    .from('videos')
    .update({ status: 'transcribing' })
    .eq('id', videoId)

  let audioBuffer: Buffer

  if (video.youtube_url) {
    // YouTube URL handling
    const youtubeIdMatch = video.youtube_url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/
    )
    
    if (!youtubeIdMatch || !youtubeIdMatch[1]) {
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', videoId)
      throw new Error('Invalid YouTube URL format')
    }

    const youtubeId = youtubeIdMatch[1]
    console.log('Downloading YouTube audio for video:', youtubeId)

    try {
      // Validate YouTube URL
      if (!ytdl.validateURL(video.youtube_url)) {
        throw new Error('Invalid YouTube URL')
      }

      // Get video info
      const info = await ytdl.getInfo(video.youtube_url)
      console.log('YouTube video info retrieved:', info.videoDetails.title)

      // Download audio stream with retry and better options
      let audioStream
      try {
        audioStream = ytdl(video.youtube_url, {
          quality: 'highestaudio',
          filter: 'audioonly',
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
          },
        })
      } catch (streamInitError: any) {
        console.error('Failed to initialize stream:', streamInitError)
        throw new Error(`Failed to initialize YouTube stream: ${streamInitError.message || 'Unknown error'}`)
      }

      // Convert stream to buffer with error handling
      const chunks: Buffer[] = []
      try {
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        audioBuffer = Buffer.concat(chunks)
        
        if (audioBuffer.length === 0) {
          throw new Error('Downloaded audio buffer is empty')
        }
      } catch (streamError: any) {
        console.error('Stream error:', streamError)
        
        // Check for specific error types
        if (streamError.statusCode === 403 || streamError.message?.includes('403')) {
          throw new Error(
            'YouTube is blocking the download (403 Forbidden). ' +
            'This is a known limitation - YouTube frequently changes their API. ' +
            'Try uploading the video file directly instead, or use yt-dlp on your server for more reliable downloads.'
          )
        }
        
        throw new Error(`Failed to download audio stream: ${streamError.message || 'Unknown error'}`)
      }

      console.log('YouTube audio downloaded, size:', audioBuffer.length, 'bytes')

      // Update video duration if available
      if (info.videoDetails.lengthSeconds) {
        await serviceClient
          .from('videos')
          .update({ duration: parseInt(info.videoDetails.lengthSeconds) })
          .eq('id', videoId)
      }
    } catch (youtubeError: any) {
      console.error('YouTube download error:', youtubeError)
      
      // Provide more helpful error messages based on error type
      let errorMessage = 'Failed to download YouTube audio'
      const errorMsg = youtubeError.message || ''
      const errorStr = errorMsg.toLowerCase()
      
      if (youtubeError.statusCode === 403 || errorStr.includes('403') || errorStr.includes('forbidden')) {
        errorMessage = 'YouTube is blocking the download (403 Forbidden). YouTube frequently changes their API, making downloads unreliable. For best results, download the video file and upload it directly.'
      } else if (errorStr.includes('could not extract') || errorStr.includes('extract functions') || errorStr.includes('decipher') || errorStr.includes('parse')) {
        errorMessage = 'YouTube has updated their player code. The download library cannot parse the new format. This is a known limitation - YouTube frequently updates their encryption. Please download the video file and upload it directly for transcription.'
      } else if (errorStr.includes('private') || errorStr.includes('unavailable')) {
        errorMessage = 'This YouTube video is private, age-restricted, or unavailable. Please use a public video or upload the video file directly.'
      } else if (errorStr.includes('region') || errorStr.includes('country')) {
        errorMessage = 'This YouTube video is not available in your region. Please upload the video file directly instead.'
      } else {
        errorMessage = `Failed to download YouTube audio: ${errorMsg || 'Unknown error'}. YouTube downloads are unreliable due to frequent API changes. For best results, download the video and upload the file directly.`
      }
      
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', videoId)
      throw new Error(errorMessage)
    }
  } else if (video.video_url) {
    // Download video from Supabase Storage
    let filePath: string
    
    if (video.video_url.includes('/storage/v1/object/public/videos/')) {
      const urlParts = video.video_url.split('/storage/v1/object/public/videos/')
      filePath = urlParts[1] || ''
    } else if (video.video_url.includes('/storage/v1/object/authenticated/videos/')) {
      const urlParts = video.video_url.split('/storage/v1/object/authenticated/videos/')
      filePath = urlParts[1] || ''
    } else {
      const urlParts = video.video_url.split('/')
      const videosIndex = urlParts.findIndex((part: string) => part === 'videos')
      if (videosIndex >= 0) {
        filePath = urlParts.slice(videosIndex + 1).join('/')
      } else {
        filePath = urlParts[urlParts.length - 1]
      }
    }

    if (!filePath) {
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', videoId)
      throw new Error('Could not extract file path from video URL')
    }
    
    const { data, error: downloadError } = await serviceClient.storage
      .from('videos')
      .download(filePath)

    if (downloadError) {
      console.error('Download error:', downloadError)
      console.error('File path attempted:', filePath)
      console.error('Video URL:', video.video_url)
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', videoId)
      throw new Error(`Failed to download video from storage: ${downloadError.message || 'Unknown error'}`)
    }

    if (!data) {
      console.error('No data returned from storage download')
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', videoId)
      throw new Error('No data returned from storage download')
    }

    const arrayBuffer = await data.arrayBuffer()
    audioBuffer = Buffer.from(arrayBuffer)
  } else {
    await serviceClient
      .from('videos')
      .update({ status: 'error' })
      .eq('id', videoId)
    throw new Error('No video file or URL found')
  }

  // Transcribe with Whisper
  const uint8Array = new Uint8Array(audioBuffer)
  
  let mimeType = 'audio/mpeg'
  if (audioBuffer.length > 4) {
    const header = audioBuffer.subarray(0, 4)
    if (header[0] === 0xff && header[1] === 0xfb) {
      mimeType = 'audio/mpeg'
    } else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
      mimeType = 'audio/wav'
    } else if (header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) {
      mimeType = 'video/webm'
    } else if (header[0] === 0x00 && header[1] === 0x00 && header[2] === 0x00) {
      mimeType = 'video/mp4'
    }
  }
  
  const blob = new Blob([uint8Array], { type: mimeType })
  const fileName = video.video_url?.split('/').pop() || 'audio.mp3'
  const file = new File([blob], fileName, { type: mimeType })
  
  console.log('Sending to OpenAI Whisper API...')
  console.log('File size:', file.size, 'bytes')
  console.log('File type:', mimeType)
  
  let transcription
  try {
    transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      language: undefined,
    })
    console.log('Transcription successful, text length:', transcription.text?.length || 0)
  } catch (openaiError: any) {
    console.error('OpenAI API error:', openaiError)
    await serviceClient
      .from('videos')
      .update({ status: 'error' })
      .eq('id', videoId)
    throw new Error(`OpenAI transcription failed: ${openaiError.message || 'Unknown error'}. Check your API key and credits.`)
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
    await serviceClient
      .from('videos')
      .update({ status: 'error' })
      .eq('id', videoId)
    throw new Error('Failed to store transcript segments')
  }

  // Update video status to ready
  await serviceClient
    .from('videos')
    .update({ status: 'ready' })
    .eq('id', videoId)

  return {
    success: true,
    transcript: transcriptText,
    segmentsCount: segments.length,
  }
}

