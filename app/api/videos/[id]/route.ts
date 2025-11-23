import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Verify video ownership
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // Delete video file from storage if it exists
    if (video.video_url) {
      try {
        // Extract file path from URL
        // Format: https://...supabase.co/storage/v1/object/public/videos/{path}
        const urlParts = video.video_url.split('/videos/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1]
          await serviceClient.storage
            .from('videos')
            .remove([filePath])
        }
      } catch (storageError) {
        // Log but don't fail if storage deletion fails
        console.error('Error deleting video file from storage:', storageError)
      }
    }

    // Delete video record (cascade will handle related records)
    const { error: deleteError } = await serviceClient
      .from('videos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting video:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete video' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete video error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

