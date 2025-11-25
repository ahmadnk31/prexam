import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import { getPublicUrl } from '@/lib/s3'
import { transcribeVideo } from '@/lib/transcribe'

// Configure for finalizing uploads
export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Finalize upload after file has been uploaded to S3 via presigned URL
 * This route is called after the client uploads the file directly to S3
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { videoId, s3Key } = body

    if (!videoId || !s3Key) {
      return NextResponse.json(
        { error: 'Missing required fields: videoId, s3Key' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Verify video ownership
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found or unauthorized' },
        { status: 404 }
      )
    }

    // Get public URL (CloudFront or S3)
    const publicUrl = getPublicUrl('videos', s3Key)

    // Update video with URL and status
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        video_url: publicUrl,
        status: 'processing',
      })
      .eq('id', videoId)

    if (updateError) {
      console.error('Error updating video:', updateError)
      return NextResponse.json(
        { error: 'Failed to update video record' },
        { status: 500 }
      )
    }

    // Trigger transcription in background
    transcribeVideo(videoId).catch(async (err) => {
      console.error('Error in background transcription:', err)
      try {
        await serviceClient
          .from('videos')
          .update({ status: 'error' })
          .eq('id', videoId)
      } catch (updateErr: any) {
        console.error('Error updating video status:', updateErr)
      }
    })

    return NextResponse.json({ 
      success: true,
      videoId,
      videoUrl: publicUrl
    })
  } catch (error: any) {
    console.error('Finalize upload error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

