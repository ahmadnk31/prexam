/**
 * Segments a transcript into chunks for processing
 */
export function segmentTranscript(
  transcript: string,
  maxChunkSize: number = 2000
): string[] {
  const sentences = transcript.split(/[.!?]+\s+/)
  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Parses Whisper API verbose_json response to extract segments with timestamps
 */
export function parseWhisperVerboseResponse(
  whisperResponse: any
): Array<{
  text: string
  start: number
  end: number
}> {
  // Whisper verbose_json returns an object with a 'segments' array
  // Each segment has: id, seek, start, end, text, tokens, temperature, avg_logprob, compression_ratio, no_speech_prob
  if (whisperResponse.segments && Array.isArray(whisperResponse.segments)) {
    return whisperResponse.segments.map((segment: any) => ({
      text: segment.text || '',
      start: segment.start || 0,
      end: segment.end || 0,
    }))
  }

  // Fallback: if no segments, create a single segment from the full text
  if (whisperResponse.text) {
    return [
      {
        text: whisperResponse.text,
        start: 0,
        end: whisperResponse.duration || 0,
      },
    ]
  }

  // Last resort: return empty array
  return []
}

/**
 * Extracts timestamps from transcript if available (legacy function for backward compatibility)
 */
export function parseTranscriptWithTimestamps(transcript: string): Array<{
  text: string
  start: number
  end: number
}> {
  // This is a fallback for when we only have text
  // Split by sentences and estimate timestamps
  const sentences = transcript.split(/[.!?]+\s+/).filter((s) => s.trim().length > 0)
  const segments: Array<{ text: string; start: number; end: number }> = []
  
  // Estimate: ~150 words per minute, ~5 words per second
  const wordsPerSecond = 2.5
  let currentTime = 0

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).length
    const duration = wordCount / wordsPerSecond
    
    segments.push({
      text: sentence.trim(),
      start: currentTime,
      end: currentTime + duration,
    })
    
    currentTime += duration
  }

  return segments
}

