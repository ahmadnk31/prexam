import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { generatePresignedUploadUrl } from '@/lib/s3-presigned'

// Configure for presigned URL generation
export const runtime = 'nodejs'
export const maxDuration = 30

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
    const { fileName, fileType, contentType, videoId } = body

    if (!fileName || !fileType || !contentType || !videoId) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, fileType, contentType, videoId' },
        { status: 400 }
      )
    }

    // Validate file type
    if (fileType !== 'videos') {
      return NextResponse.json(
        { error: 'Invalid file type. Only videos are supported for presigned uploads.' },
        { status: 400 }
      )
    }

    // Generate presigned URL
    try {
      const { url, key } = await generatePresignedUploadUrl(
        'videos',
        user.id,
        fileName,
        contentType,
        3600 // 1 hour expiration
      )

      console.log('Presigned URL generated:', {
        videoId,
        fileName,
        key,
        urlLength: url.length,
        expiresIn: 3600
      })

      return NextResponse.json({
        presignedUrl: url,
        key,
        expiresIn: 3600,
      })
    } catch (error: any) {
      console.error('Error generating presigned URL:', error)
      throw error
    }
  } catch (error: any) {
    console.error('Error generating presigned URL:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate presigned URL',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

