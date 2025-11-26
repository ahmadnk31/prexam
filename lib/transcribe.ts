import { createServiceClient } from '@/supabase/service'
import { openai } from '@/lib/openai'
import { parseWhisperVerboseResponse } from '@/lib/transcript'
import ytdl from '@distube/ytdl-core'
import { YoutubeTranscript } from 'youtube-transcript'
import { getYouTubeCaptions } from '@/lib/youtube-api'
import { getSubtitles } from 'youtube-captions-scraper'
import { ApifyClient } from 'apify-client'
import { readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

/**
 * Clean up YouTube player script files created by ytdl-core
 * These are temporary cache files that get created in the project root
 */
function cleanupPlayerScripts() {
  try {
    const projectRoot = process.cwd()
    const files = readdirSync(projectRoot)
    const playerScriptFiles = files.filter(file => file.endsWith('-player-script.js'))
    
    for (const file of playerScriptFiles) {
      try {
        unlinkSync(join(projectRoot, file))
        console.log('Cleaned up player script file:', file)
      } catch (err) {
        // Ignore errors - cleanup is not critical
      }
    }
  } catch (err) {
    // Ignore errors - cleanup is not critical
  }
}

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
    // YouTube URL handling - support multiple URL formats
    const youtubeIdMatch = video.youtube_url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|m\.youtube\.com\/watch\?v=)([^&\n?#]+)/
    )
    
    if (!youtubeIdMatch || !youtubeIdMatch[1]) {
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', videoId)
      throw new Error('Invalid YouTube URL format. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...')
    }

    const youtubeId = youtubeIdMatch[1]
    console.log('Processing YouTube video:', youtubeId)
    console.log('YouTube API key configured:', !!process.env.YOUTUBE_API_KEY)

    // Try to get transcript using official YouTube API first (most reliable)
    let transcriptText = ''
    let segments: Array<{ text: string; start: number; end: number }> = []
    let useTranscriptAPI = false
    let transcriptErrors: string[] = []
    
    // Method 1: Try official YouTube Data API v3 (requires API key)
    // NOTE: This only works for videos you own due to API limitations
    if (process.env.YOUTUBE_API_KEY) {
      try {
        console.log('📡 Method 1: Attempting to fetch captions using official YouTube Data API v3...')
        console.log('   Note: Official API only works for videos you own')
        segments = await getYouTubeCaptions(youtubeId)
        
        if (segments && segments.length > 0) {
          console.log('✅ Successfully fetched YouTube captions via official API, segments:', segments.length)
          useTranscriptAPI = true
          transcriptText = segments.map(seg => seg.text).join(' ')
        } else {
          transcriptErrors.push('Official API returned empty segments')
        }
      } catch (apiError: any) {
        const errorMsg = apiError.message || 'Unknown error'
        console.warn('❌ Official YouTube API failed:', errorMsg)
        
        // If it's a permission error (video not owned), that's expected for public videos
        if (errorMsg.includes('only works for videos you own')) {
          console.log('   This is expected for public videos - API only works for videos you own')
        }
        
        transcriptErrors.push(`Official API: ${errorMsg}`)
        // Continue to fallback methods
      }
    } else {
      console.log('⚠️ YouTube API key not configured, skipping official API method')
      transcriptErrors.push('YouTube API key not configured')
    }
    
    // Method 2: Try Apify YouTube Transcript Scraper (requires API token, very reliable)
    if (!useTranscriptAPI && process.env.APIFY_API_TOKEN) {
      try {
        console.log('📡 Method 2: Attempting to fetch YouTube transcript using Apify...')
        console.log('   Video ID:', youtubeId)
        
        const client = new ApifyClient({
          token: process.env.APIFY_API_TOKEN,
        })
        
        const input = {
          startUrls: [`https://www.youtube.com/watch?v=${youtubeId}`],
          language: 'Default',
          includeTimestamps: 'Yes', // We need timestamps for segments
        }
        
        // Run the Actor and wait for it to finish
        const run = await client.actor('CTQcdDtqW5dvELvur').call(input)
        
        // Fetch results from the run's dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems()
        
        console.log('Apify returned items:', items?.length || 0)
        if (items && items.length > 0) {
          // Log first item to understand structure
          console.log('First Apify item structure:', JSON.stringify(items[0], null, 2).substring(0, 500))
          
          // Apify returns items with transcript data
          // Format may vary, but typically has transcript or captions array
          const transcriptItem = items[0]
          
          // Handle different possible response formats
          let transcriptSegments: any[] = []
          
          if (transcriptItem.transcript && Array.isArray(transcriptItem.transcript)) {
            transcriptSegments = transcriptItem.transcript
            console.log('Using transcript array, length:', transcriptSegments.length)
          } else if (transcriptItem.captions && Array.isArray(transcriptItem.captions)) {
            transcriptSegments = transcriptItem.captions
            console.log('Using captions array, length:', transcriptSegments.length)
          } else if (transcriptItem.text) {
            // Single text block, create one segment
            transcriptSegments = [{
              text: transcriptItem.text,
              start: 0,
              end: transcriptItem.duration || 0,
            }]
            console.log('Using single text block')
          } else if (Array.isArray(transcriptItem)) {
            transcriptSegments = transcriptItem
            console.log('Item is array, length:', transcriptSegments.length)
          } else {
            // Try to find any array property
            const arrayKeys = Object.keys(transcriptItem).filter(key => Array.isArray(transcriptItem[key]))
            if (arrayKeys.length > 0) {
              console.log('Found array properties:', arrayKeys)
              transcriptSegments = transcriptItem[arrayKeys[0]]
            } else {
              // Last resort: check if item has timestamped entries
              console.log('Checking for timestamped entries in item keys:', Object.keys(transcriptItem))
            }
          }
          
          if (transcriptSegments.length > 0) {
            console.log('✅ Successfully fetched YouTube transcript via Apify, segments:', transcriptSegments.length)
            console.log('Sample segment:', JSON.stringify(transcriptSegments[0], null, 2))
            useTranscriptAPI = true
            
            // Convert to our format
            transcriptText = transcriptSegments.map((item: any) => item.text || item).join(' ')
            segments = transcriptSegments.map((item: any) => {
              // Handle different timestamp formats
              const start = item.start || item.startTime || item.offset || item.time || 0
              const duration = item.dur || item.duration || item.endTime || 0
              const end = item.end || item.endTime || (start + duration)
              const text = item.text || item.content || item.transcript || String(item)
              
              // Convert milliseconds to seconds if needed
              const startSeconds = typeof start === 'number' ? (start > 1000 ? start / 1000 : start) : parseFloat(start) || 0
              const endSeconds = typeof end === 'number' ? (end > 1000 ? end / 1000 : end) : (typeof duration === 'number' ? (duration > 1000 ? duration / 1000 : duration) : parseFloat(duration) || 0)
              const finalEnd = endSeconds > startSeconds ? endSeconds : (startSeconds + (typeof duration === 'number' ? (duration > 1000 ? duration / 1000 : duration) : parseFloat(duration) || 0))
              
              return {
                text: text.trim(),
                start: startSeconds,
                end: finalEnd,
              }
            }).filter((seg: any) => seg.text && seg.text.trim().length > 0)
            
            console.log('Converted segments count:', segments.length)
            console.log('Sample converted segment:', segments[0])
            
            if (segments.length === 0) {
              throw new Error('Apify returned data but no valid segments found')
            }
          } else {
            transcriptErrors.push('Apify returned empty transcript data')
            console.error('No transcript segments found in Apify response')
          }
        } else {
          transcriptErrors.push('Apify returned no items')
          console.error('Apify returned no items')
        }
      } catch (apifyError: any) {
        const errorMsg = apifyError.message || 'Unknown error'
        console.warn('❌ Apify method failed:', errorMsg)
        transcriptErrors.push(`Apify: ${errorMsg}`)
        // Continue to fallback methods
      }
    } else if (!useTranscriptAPI && !process.env.APIFY_API_TOKEN) {
      console.log('⚠️ Apify API token not configured, skipping Apify method')
      console.log('   To use Apify: Get token from https://console.apify.com/account/integrations and add APIFY_API_TOKEN to .env.local')
      transcriptErrors.push('Apify API token not configured')
    }
    
    // Method 3: Try youtube-transcript library (no API key needed, often most reliable)
    if (!useTranscriptAPI) {
      try {
        console.log('📡 Method 3: Attempting to fetch YouTube transcript using youtube-transcript library...')
        console.log('   Video ID:', youtubeId)
        
        // Try to fetch transcript - this will fail if video has no captions
        let transcriptData
        try {
          transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId)
          console.log('   Got transcript data:', transcriptData?.length || 0, 'segments')
        } catch (fetchError: any) {
          const errorMsg = fetchError.message?.toLowerCase() || ''
          console.warn('   youtube-transcript error:', fetchError.message)
          
          // Check if it's a "no captions" error
          if (errorMsg.includes('transcript') || errorMsg.includes('caption') || errorMsg.includes('not available') || errorMsg.includes('could not retrieve') || errorMsg.includes('no captions')) {
            const fullError = 'This video does not have captions/transcripts available. Please try a video with captions enabled, or download and upload the video file directly.'
            console.warn('❌', fullError)
            transcriptErrors.push(`youtube-transcript: ${fullError}`)
            throw new Error(fullError)
          }
          throw fetchError
        }
        
        if (transcriptData && transcriptData.length > 0) {
          console.log('✅ Successfully fetched YouTube transcript via youtube-transcript, segments:', transcriptData.length)
          useTranscriptAPI = true
          
          // Convert transcript data to our format
          transcriptText = transcriptData.map(item => item.text).join(' ')
          segments = transcriptData.map((item, index) => ({
            text: item.text,
            start: item.offset / 1000, // Convert milliseconds to seconds
            end: index < transcriptData.length - 1 
              ? transcriptData[index + 1].offset / 1000 
              : item.offset / 1000 + (item.duration || 0) / 1000,
          }))
        } else {
          transcriptErrors.push('youtube-transcript returned empty data')
        }
      } catch (transcriptError: any) {
        const errorMsg = transcriptError.message || 'Unknown error'
        console.warn('❌ youtube-transcript method failed:', errorMsg)
        transcriptErrors.push(`youtube-transcript: ${errorMsg}`)
        // Continue to next fallback method
      }
    }
    
    // Method 4: Try youtube-captions-scraper (no API key needed, alternative method)
    if (!useTranscriptAPI) {
      try {
        console.log('📡 Method 4: Attempting to fetch YouTube captions using youtube-captions-scraper...')
        console.log('   Video ID:', youtubeId)
        
        // Try to fetch captions - this will fail if video has no captions
        let captionsData: any[] | null = null
        let lastError: any = null
        
        try {
          captionsData = await getSubtitles({
            videoID: youtubeId,
            lang: 'en', // Try English first
          })
          console.log('   Got captions with lang=en:', captionsData?.length || 0, 'segments')
        } catch (fetchError: any) {
          lastError = fetchError
          console.log('   English captions failed, trying auto-detect...')
          
          // Try without language specification (auto-detect)
          try {
            captionsData = await getSubtitles({
              videoID: youtubeId,
            })
            console.log('   Got captions with auto-detect:', captionsData?.length || 0, 'segments')
          } catch (retryError: any) {
            lastError = retryError
            const errorMsg = retryError.message?.toLowerCase() || ''
            console.warn('   youtube-captions-scraper error:', retryError.message)
            
            // Check if it's a "no captions" error
            if (errorMsg.includes('transcript') || errorMsg.includes('caption') || errorMsg.includes('not available') || errorMsg.includes('could not retrieve') || errorMsg.includes('no captions')) {
              const fullError = 'This video does not have captions/transcripts available. Please try a video with captions enabled, or download and upload the video file directly.'
              console.warn('❌', fullError)
              transcriptErrors.push(`youtube-captions-scraper: ${fullError}`)
              throw new Error(fullError)
            }
            throw retryError
          }
        }
        
        if (captionsData && captionsData.length > 0) {
          console.log('✅ Successfully fetched YouTube captions via youtube-captions-scraper, segments:', captionsData.length)
          useTranscriptAPI = true
          
          // Convert captions data to our format
          // getSubtitles returns: { start: number, dur: number, text: string }
          transcriptText = captionsData.map((item: any) => item.text).join(' ')
          segments = captionsData.map((item: any) => ({
            text: item.text,
            start: item.start,
            end: item.start + (item.dur || 0),
          }))
        } else {
          const errorMsg = lastError?.message || 'Returned empty data'
          console.warn('   youtube-captions-scraper returned empty or no data')
          transcriptErrors.push(`youtube-captions-scraper: ${errorMsg}`)
        }
      } catch (scraperError: any) {
        const errorMsg = scraperError.message || 'Unknown error'
        console.warn('❌ youtube-captions-scraper failed:', errorMsg)
        transcriptErrors.push(`youtube-captions-scraper: ${errorMsg}`)
        // Continue to audio download fallback
      }
    }
    
    // If all transcript methods failed, provide a clear error before trying audio download
    if (!useTranscriptAPI) {
      console.warn('⚠️ All transcript methods failed. Attempted methods:', transcriptErrors.length)
      console.warn('Errors:', transcriptErrors)
      
      // Check if the errors indicate no captions are available
      const allErrors = transcriptErrors.join(' ').toLowerCase()
      const hasNoCaptionsError = allErrors.includes('no captions') || 
                                 allErrors.includes('not available') || 
                                 allErrors.includes('could not retrieve') ||
                                 allErrors.includes('does not have captions')
      
      if (hasNoCaptionsError || transcriptErrors.length >= 2) {
        // If multiple methods failed or we have clear "no captions" errors, don't try audio download
        await serviceClient
          .from('videos')
          .update({ status: 'error' })
          .eq('id', videoId)
        
        let errorMessage = 'This video does not have captions/transcripts available. '
        
        if (!process.env.YOUTUBE_API_KEY) {
          errorMessage += 'Note: Setting up a free YouTube API key may improve reliability. '
        }
        
        errorMessage += 'Please try a video with captions enabled (look for the CC button on YouTube), or download and upload the video file directly.'
        
        // Clean up player scripts before throwing
        cleanupPlayerScripts()
        
        throw new Error(errorMessage)
      }
      
      // If we only have 1 error or unclear errors, log but continue to audio download
      console.log('⚠️ Transcript methods failed, but attempting audio download as last resort...')
    }
    
    // If we successfully got transcripts from either method, store them
    if (useTranscriptAPI && segments.length > 0) {
      // Get video info for duration
      try {
        const info = await ytdl.getInfo(video.youtube_url)
        if (info.videoDetails.lengthSeconds) {
          await serviceClient
            .from('videos')
            .update({ duration: parseInt(info.videoDetails.lengthSeconds) })
            .eq('id', videoId)
        }
      } catch (infoError) {
        console.warn('Could not fetch video info for duration:', infoError)
        // Not critical, continue without duration
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
    
    // Fall back to downloading audio if transcript API didn't work
    if (!useTranscriptAPI) {
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
              'This video may not have captions available. Please try a video with captions enabled, or download and upload the video file directly.'
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
        let errorMessage = 'Failed to process YouTube video'
      const errorMsg = youtubeError.message || ''
      const errorStr = errorMsg.toLowerCase()
      
      if (youtubeError.statusCode === 403 || errorStr.includes('403') || errorStr.includes('forbidden')) {
          errorMessage = 'YouTube is blocking the download (403 Forbidden). This video does not have captions available, and YouTube is blocking audio downloads. Please try a video with captions enabled, or download and upload the video file directly.'
      } else if (errorStr.includes('could not extract') || errorStr.includes('extract functions') || errorStr.includes('decipher') || errorStr.includes('parse')) {
          errorMessage = 'YouTube has updated their player code. The download library cannot parse the new format. Please try a video with captions enabled, or download the video file and upload it directly for transcription.'
      } else if (errorStr.includes('private') || errorStr.includes('unavailable')) {
          errorMessage = 'This YouTube video is private, age-restricted, or unavailable. Please use a public video with captions enabled, or upload the video file directly.'
      } else if (errorStr.includes('region') || errorStr.includes('country')) {
        errorMessage = 'This YouTube video is not available in your region. Please upload the video file directly instead.'
        } else if (errorStr.includes('transcript') || errorStr.includes('caption')) {
          errorMessage = 'This video does not have captions/transcripts available. Please try a video with captions enabled, or download and upload the video file directly.'
      } else {
          errorMessage = `Failed to process YouTube video: ${errorMsg || 'Unknown error'}. Please try a video with captions enabled, or download the video and upload the file directly.`
      }
      
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', videoId)
        
        // Clean up player scripts even on error
        cleanupPlayerScripts()
        
      throw new Error(errorMessage)
      }
    }
  } else if (video.video_url) {
    // Extract audio from video using AWS Lambda (if configured) or download directly
    const { extractS3KeyFromUrl, downloadFromS3, getPublicUrl } = await import('@/lib/s3')
    
    const s3Key = extractS3KeyFromUrl(video.video_url)
    
    if (!s3Key) {
      await serviceClient
        .from('videos')
        .update({ status: 'error' })
        .eq('id', videoId)
      throw new Error('Could not extract S3 key from video URL')
    }

    // Try to use Lambda for audio extraction if configured
    const useLambda = !!process.env.AWS_LAMBDA_EXTRACT_AUDIO_FUNCTION
    const s3Bucket = process.env.AWS_S3_BUCKET || ''
    
    if (useLambda && s3Bucket) {
      try {
        console.log('Using AWS Lambda to extract audio from video')
        const { extractAudioFromVideo } = await import('@/lib/lambda-audio-extract')
        
        // Extract audio using Lambda
        const audioResult = await extractAudioFromVideo({
          videoS3Key: s3Key,
          videoS3Bucket: s3Bucket,
          outputS3Key: s3Key.replace(/\.(mp4|webm|mov|avi|mkv)$/i, '.mp3').replace(/^videos\//, 'audio/'),
          outputS3Bucket: s3Bucket,
        })
        
        console.log('Audio extracted successfully:', audioResult)
        
        // Download the extracted audio file
        const audioS3Key = audioResult.audioS3Key
        try {
          const fileBuffer = await downloadFromS3('audio', audioS3Key.replace(/^audio\//, ''))
          audioBuffer = fileBuffer
        } catch (downloadError: any) {
          console.error('Failed to download extracted audio:', downloadError)
          // Fall back to downloading video directly
          console.log('Falling back to direct video download')
          const fileBuffer = await downloadFromS3('videos', s3Key)
          audioBuffer = fileBuffer
        }
      } catch (lambdaError: any) {
        console.warn('Lambda audio extraction failed, falling back to direct download:', lambdaError.message)
        // Fall back to downloading video directly
        let arrayBuffer: ArrayBuffer
        try {
          const fileBuffer = await downloadFromS3('videos', s3Key)
          arrayBuffer = fileBuffer.buffer
        } catch (downloadError: any) {
          console.error('S3 download error:', downloadError)
          await serviceClient
            .from('videos')
            .update({ status: 'error' })
            .eq('id', videoId)
          throw new Error(`Failed to download video from S3: ${downloadError.message || 'Unknown error'}`)
        }
        audioBuffer = Buffer.from(arrayBuffer)
      }
    } else {
      // Direct download (original behavior)
      console.log('Downloading video directly from S3 (Lambda not configured)')
      let arrayBuffer: ArrayBuffer
      try {
        const fileBuffer = await downloadFromS3('videos', s3Key)
        arrayBuffer = fileBuffer.buffer
      } catch (downloadError: any) {
        console.error('S3 download error:', downloadError)
        console.error('S3 key attempted:', s3Key)
        console.error('Video URL:', video.video_url)
        await serviceClient
          .from('videos')
          .update({ status: 'error' })
          .eq('id', videoId)
        throw new Error(`Failed to download video from S3: ${downloadError.message || 'Unknown error'}`)
      }
      audioBuffer = Buffer.from(arrayBuffer)
    }
  } else {
    await serviceClient
      .from('videos')
      .update({ status: 'error' })
      .eq('id', videoId)
    throw new Error('No video file or URL found')
  }

  // Check file size (OpenAI Whisper has a 25MB limit)
  const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB in bytes
  if (audioBuffer.length > MAX_FILE_SIZE) {
    await serviceClient
      .from('videos')
      .update({ status: 'error' })
      .eq('id', videoId)
    throw new Error(`File is too large (${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB). OpenAI Whisper API has a 25MB limit. Please use a smaller file or extract audio first.`)
  }

  // Transcribe with Whisper
  const uint8Array = new Uint8Array(audioBuffer)
  
  // Detect file format more accurately
  let mimeType = 'audio/mpeg'
  let fileExtension = 'mp3'
  
  if (audioBuffer.length > 12) {
    // Check for MP4 (ftyp box at offset 4)
    if (audioBuffer[4] === 0x66 && audioBuffer[5] === 0x74 && audioBuffer[6] === 0x79 && audioBuffer[7] === 0x70) {
      mimeType = 'video/mp4'
      fileExtension = 'mp4'
    }
    // Check for WebM
    else if (audioBuffer[0] === 0x1a && audioBuffer[1] === 0x45 && audioBuffer[2] === 0xdf && audioBuffer[3] === 0xa3) {
      mimeType = 'video/webm'
      fileExtension = 'webm'
    }
    // Check for MP3 (ID3v2 or MPEG header)
    else if ((audioBuffer[0] === 0xff && (audioBuffer[1] & 0xe0) === 0xe0) || 
             (audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33)) {
      mimeType = 'audio/mpeg'
      fileExtension = 'mp3'
    }
    // Check for WAV (RIFF header)
    else if (audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49 && audioBuffer[2] === 0x46 && audioBuffer[3] === 0x46) {
      mimeType = 'audio/wav'
      fileExtension = 'wav'
    }
    // Check for M4A (MP4 container)
    else if (audioBuffer[4] === 0x66 && audioBuffer[5] === 0x74 && audioBuffer[6] === 0x79 && audioBuffer[7] === 0x70) {
      mimeType = 'audio/mp4'
      fileExtension = 'm4a'
    }
  }
  
  const blob = new Blob([uint8Array], { type: mimeType })
  const fileName = video.video_url?.split('/').pop() || `audio.${fileExtension}`
  const file = new File([blob], fileName, { type: mimeType })
  
  console.log('Sending to OpenAI Whisper API...')
  console.log('File size:', file.size, 'bytes', `(${(file.size / 1024 / 1024).toFixed(2)}MB)`)
  console.log('File type:', mimeType)
  console.log('File name:', fileName)
  
  // Validate file before sending
  if (file.size === 0) {
    await serviceClient
      .from('videos')
      .update({ status: 'error' })
      .eq('id', videoId)
    throw new Error('File is empty. Cannot transcribe.')
  }
  
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
    console.error('Error details:', {
      status: openaiError.status,
      message: openaiError.message,
      code: openaiError.code,
      type: openaiError.type,
      fileSize: file.size,
      fileType: mimeType,
      fileName: fileName,
    })
    
    await serviceClient
      .from('videos')
      .update({ status: 'error' })
      .eq('id', videoId)
    
    // Provide more specific error messages
    let errorMessage = 'OpenAI transcription failed'
    if (openaiError.status === 400) {
      if (openaiError.message?.includes('file') || openaiError.message?.includes('format')) {
        errorMessage = `File format error: ${openaiError.message}. The file might be corrupted or in an unsupported format. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm.`
      } else if (openaiError.message?.includes('size') || file.size > MAX_FILE_SIZE) {
        errorMessage = `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). OpenAI Whisper API has a 25MB limit. Please use a smaller file.`
      } else {
        errorMessage = `Invalid request: ${openaiError.message}. Check that the file is a valid audio/video file.`
      }
    } else if (openaiError.status === 401) {
      errorMessage = 'OpenAI API key is invalid or expired. Check your OPENAI_API_KEY environment variable.'
    } else if (openaiError.status === 429) {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again later.'
    } else if (openaiError.status === 500 || openaiError.status === 503) {
      errorMessage = 'OpenAI API is temporarily unavailable. Please try again later.'
    } else {
      errorMessage = `${openaiError.message || 'Unknown error'}. Check your API key and credits.`
    }
    
    throw new Error(errorMessage)
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

  // Clean up any player script files created by ytdl-core
  cleanupPlayerScripts()

  return {
    success: true,
    transcript: transcriptText,
    segmentsCount: segments.length,
  }
}

