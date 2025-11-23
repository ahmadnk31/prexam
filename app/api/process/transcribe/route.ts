import { NextRequest, NextResponse } from 'next/server'
import { transcribeVideo } from '@/lib/transcribe'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const videoId = body.videoId

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID required' },
        { status: 400 }
      )
    }

    // Use the shared transcription function
    const result = await transcribeVideo(videoId)

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      segmentsCount: result.segmentsCount,
    })
  } catch (error: any) {
    console.error('Transcription API error:', error)
    
    return NextResponse.json(
      {
        error: 'Transcription failed',
        message: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
