import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import { transcribeVideo } from '@/lib/transcribe'

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
    const file = formData.get('file') as File
    const youtubeUrl = formData.get('youtubeUrl') as string | null
    const title = formData.get('title') as string | null

    if (!file && !youtubeUrl) {
      return NextResponse.json(
        { error: 'File or YouTube URL required' },
        { status: 400 }
      )
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

    // If file upload, upload to Supabase Storage
    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${video.id}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await serviceClient.storage
        .from('videos')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        
        // Check if it's a bucket not found error
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist')) {
          await serviceClient
            .from('videos')
            .update({ status: 'error' })
            .eq('id', video.id)
          
          return NextResponse.json(
            { 
              error: 'Storage bucket not found',
              message: 'The "videos" bucket does not exist in Supabase Storage. Please create it in your Supabase dashboard under Storage.',
              details: 'See SUPABASE_SETUP.md for instructions'
            },
            { status: 500 }
          )
        }
        
        // Update video status to error
        await serviceClient
          .from('videos')
          .update({ status: 'error' })
          .eq('id', video.id)

        return NextResponse.json(
          { 
            error: 'Failed to upload file',
            message: uploadError.message || 'Unknown error',
            details: uploadError
          },
          { status: 500 }
        )
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = serviceClient.storage.from('videos').getPublicUrl(filePath)

      // Update video with URL
      await serviceClient
        .from('videos')
        .update({
          video_url: publicUrl,
          status: 'processing',
        })
        .eq('id', video.id)
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

