'use server'

import { redirect } from 'next/navigation'
import { transcribeVideo } from '@/lib/transcribe'

export async function retryTranscription(formData: FormData) {
  const videoId = formData.get('videoId') as string
  if (!videoId) {
    console.error('Video ID is required')
    return
  }
  try {
    await transcribeVideo(videoId)
    redirect(`/dashboard/videos/${videoId}`)
  } catch (error: any) {
    console.error('Transcription error:', error)
    redirect(`/dashboard/videos/${videoId}`)
  }
}

