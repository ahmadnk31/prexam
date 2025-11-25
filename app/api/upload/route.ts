import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import { transcribeVideo } from '@/lib/transcribe'
import { uploadToS3, getPublicUrl } from '@/lib/s3'

// Configure for large file uploads
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large uploads

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check content type to determine how to parse the request
    const contentType = req.headers.get('content-type') || ''
    
    // Handle JSON requests (for presigned URL flow)
    if (contentType.includes('application/json')) {
      const body = await req.json()
      const { title, fileSize, fileName, usePresignedUrl } = body

      if (usePresignedUrl) {
        // Create video record for presigned URL upload
        const serviceClient = createServiceClient()
        const { data: video, error: videoError } = await serviceClient
          .from('videos')
          .insert({
            user_id: user.id,
            title: title || fileName || 'Untitled Video',
            status: 'uploading',
            file_size: fileSize || null,
          })
          .select()
          .single()

        if (videoError || !video) {
          console.error('Error creating video:', videoError)
          return NextResponse.json(
            { error: 'Failed to create video record' },
            { status: 500 }
          )
        }

        return NextResponse.json({ videoId: video.id, video })
      }
    }

    // Handle FormData requests (for YouTube URLs or small files)
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (error: any) {
      console.error('FormData parsing error:', error)
      
      // If it's a size issue, suggest using presigned URL upload
      if (error.message?.includes('body') || error.message?.includes('size') || error.message?.includes('limit')) {
        return NextResponse.json(
          { 
            error: 'File too large',
            message: 'The file is too large to upload directly through the API route. Please use a smaller file or the upload will automatically use direct S3 upload.',
            code: 'FILE_TOO_LARGE',
            suggestion: 'Large files should use direct S3 uploads with presigned URLs.'
          },
          { status: 413 }
        )
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to parse form data',
          message: error.message || 'The request body could not be parsed as FormData.',
          details: 'Make sure you are sending a proper multipart/form-data request with a file or YouTube URL.'
        },
        { status: 400 }
      )
    }
    
    const file = formData.get('file') as File | null
    const youtubeUrl = formData.get('youtubeUrl') as string | null
    const title = formData.get('title') as string | null

    if (!file && !youtubeUrl) {
      return NextResponse.json(
        { error: 'File or YouTube URL required' },
        { status: 400 }
      )
    }

    // Validate YouTube URL format if provided
    if (youtubeUrl) {
      const trimmedUrl = youtubeUrl.trim()
      const youtubePattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|m\.youtube\.com\/watch\?v=)([^&\n?#]+)/
      if (!youtubePattern.test(trimmedUrl)) {
        return NextResponse.json(
          { 
            error: 'Invalid YouTube URL format',
            message: 'Please provide a valid YouTube URL. Supported formats:\n- https://www.youtube.com/watch?v=VIDEO_ID\n- https://youtu.be/VIDEO_ID\n- https://www.youtube.com/embed/VIDEO_ID'
          },
          { status: 400 }
        )
      }
    }

    const serviceClient = createServiceClient()

    // Create video record
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .insert({
        user_id: user.id,
        title: title || (file ? file.name : 'Untitled Video'),
        youtube_url: youtubeUrl || null,
        status: 'uploading',
        file_size: file ? file.size : null,
      })
      .select()
      .single()

    if (videoError || !video) {
      console.error('Error creating video:', videoError)
      return NextResponse.json(
        { error: 'Failed to create video record' },
        { status: 500 }
      )
    }

    // If file upload, upload to S3 (for small files only - large files use presigned URLs)
    if (file) {
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${video.id}.${fileExt}`

        // Upload to S3
        const s3Key = await uploadToS3('videos', user.id, fileName, file, file.type)

        // Get public URL (CloudFront or S3)
        const publicUrl = getPublicUrl('videos', s3Key)

        // Update video with URL
        await serviceClient
          .from('videos')
          .update({
            video_url: publicUrl,
            status: 'processing',
          })
          .eq('id', video.id)
      } catch (uploadError: any) {
        console.error('S3 upload error:', uploadError)
        
        // Update video status to error
        await serviceClient
          .from('videos')
          .update({ status: 'error' })
          .eq('id', video.id)

        return NextResponse.json(
          { 
            error: 'Failed to upload file',
            message: uploadError.message || 'Unknown error',
            details: 'Check AWS credentials and S3 bucket configuration'
          },
          { status: 500 }
        )
      }
    } else if (youtubeUrl) {
      // For YouTube URLs, mark as processing
      await serviceClient
        .from('videos')
        .update({ status: 'processing' })
        .eq('id', video.id)
    }

    // Trigger transcription (async) for both uploaded files and YouTube videos
    if (file || youtubeUrl) {
      // Don't await - let it run in background
      transcribeVideo(video.id).catch(async (err) => {
        console.error('Error in background transcription:', err)
        // Update status to error if transcription fails
        try {
          await serviceClient
            .from('videos')
            .update({ status: 'error' })
            .eq('id', video.id)
        } catch (updateErr: any) {
          console.error('Error updating video status:', updateErr)
        }
      })
    }

    return NextResponse.json({ videoId: video.id, video })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
