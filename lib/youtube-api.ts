import { google } from 'googleapis'

/**
 * Get YouTube captions using the official YouTube Data API v3
 * Free tier: 10,000 units/day
 * Captions.download: 200 units per request
 * So ~50 requests/day for free
 */
export async function getYouTubeCaptions(youtubeId: string): Promise<Array<{ text: string; start: number; end: number }>> {
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set. Get a free API key from https://console.cloud.google.com/apis/credentials')
  }

  const youtube = google.youtube({
    version: 'v3',
    auth: apiKey,
  })

  try {
    // Step 1: List available caption tracks for the video
    // Note: This requires OAuth and only works for videos you own
    // For public videos, we'll get a 403 or empty response
    const captionListResponse = await youtube.captions.list({
      part: ['snippet'],
      videoId: youtubeId,
    })

    if (!captionListResponse.data.items || captionListResponse.data.items.length === 0) {
      throw new Error('No captions available for this video via API (API only works for videos you own)')
    }

    // Prefer English captions, but use any available
    let captionId: string | null = null
    const items = captionListResponse.data.items

    // Try to find English captions first
    const englishCaption = items.find(
      (item) => item.snippet?.language === 'en' || item.snippet?.language?.startsWith('en-')
    )

    if (englishCaption?.id) {
      captionId = englishCaption.id
    } else if (items[0]?.id) {
      // Use the first available caption track
      captionId = items[0].id
    }

    if (!captionId) {
      throw new Error('Could not find a valid caption track')
    }

    // Step 2: Download the caption track
    const captionResponse = await youtube.captions.download({
      id: captionId,
      tfmt: 'srt', // SRT format for timestamps
    })

    // The response is a readable stream, convert to string
    let captionText = ''
    if (captionResponse.data) {
      if (typeof captionResponse.data === 'string') {
        captionText = captionResponse.data
      } else if (Buffer.isBuffer(captionResponse.data)) {
        captionText = captionResponse.data.toString('utf-8')
      } else {
        // Handle stream
        const chunks: Buffer[] = []
        for await (const chunk of captionResponse.data as any) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        captionText = Buffer.concat(chunks).toString('utf-8')
      }
    }

    if (!captionText) {
      throw new Error('Caption download returned empty data')
    }

    // Step 3: Parse SRT format to extract text and timestamps
    return parseSRT(captionText)
  } catch (error: any) {
    if (error.code === 403) {
      // 403 can mean: quota exceeded, API key invalid, or insufficient permissions
      // The captions.download API only works for videos you own
      if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
        throw new Error('YouTube API captions.download only works for videos you own. For public videos, use the unofficial transcript method instead.')
      }
      throw new Error('YouTube API quota exceeded or API key invalid. Check your API key and quota at https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas')
    }
    if (error.code === 404) {
      throw new Error('Video not found or captions not available')
    }
    if (error.message?.includes('only works for videos you own')) {
      throw error // Re-throw our custom message
    }
    throw new Error(`YouTube API error: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Parse SRT (SubRip) subtitle format
 * Format:
 * 1
 * 00:00:00,000 --> 00:00:05,000
 * Text content here
 */
function parseSRT(srtText: string): Array<{ text: string; start: number; end: number }> {
  const segments: Array<{ text: string; start: number; end: number }> = []
  const blocks = srtText.trim().split(/\n\s*\n/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue

    // Line 0: sequence number (ignore)
    // Line 1: timestamp (e.g., "00:00:00,000 --> 00:00:05,000")
    // Line 2+: text content

    const timestampLine = lines[1]
    const text = lines.slice(2).join(' ').trim()

    if (!timestampLine || !text) continue

    const match = timestampLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
    if (!match) continue

    const startHours = parseInt(match[1])
    const startMinutes = parseInt(match[2])
    const startSeconds = parseInt(match[3])
    const startMs = parseInt(match[4])
    const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMs / 1000

    const endHours = parseInt(match[5])
    const endMinutes = parseInt(match[6])
    const endSeconds = parseInt(match[7])
    const endMs = parseInt(match[8])
    const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMs / 1000

    segments.push({ text, start, end })
  }

  return segments
}

