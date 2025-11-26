import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'
import { uploadToS3, getPublicUrl } from '@/lib/s3'
import { processDocument } from '@/lib/document-processor'

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

    // Try to parse FormData - don't check content-type as browser sets it automatically
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (error: any) {
      console.error('FormData parsing error:', error)
      console.error('Content-Type:', req.headers.get('content-type'))
      console.error('Content-Length:', req.headers.get('content-length'))
      
      // If it's a size issue, suggest using presigned URL upload
      if (error.message?.includes('body') || error.message?.includes('size')) {
        return NextResponse.json(
          { 
            error: 'File too large',
            message: 'The file is too large to upload directly. Please use a smaller file or contact support.',
            code: 'FILE_TOO_LARGE'
          },
          { status: 413 }
        )
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to parse form data',
          message: error.message || 'The request body could not be parsed as FormData.',
          details: 'Make sure you are sending a proper multipart/form-data request with a file.'
        },
        { status: 400 }
      )
    }
    const file = formData.get('file') as File
    const title = (formData.get('title') as string) || file?.name || 'Untitled Document'

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file type
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    const allowedTypes = ['pdf', 'docx', 'epub']
    if (!fileExt || !allowedTypes.includes(fileExt)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, Word (.docx), and EPUB files are supported.' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Create document record
    const { data: document, error: documentError } = await serviceClient
      .from('documents')
      .insert({
        title,
        user_id: user.id,
        file_type: fileExt,
        file_size: file.size,
        status: 'uploading',
      })
      .select()
      .single()

    if (documentError || !document) {
      console.error('Error creating document record:', documentError)
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    // Upload file to S3
    try {
      // Validate S3 configuration before attempting upload
      const s3Bucket = process.env.AWS_S3_BUCKET
      if (!s3Bucket) {
        console.error('AWS_S3_BUCKET is not set in environment variables')
        throw new Error('S3 bucket not configured. Please set AWS_S3_BUCKET environment variable.')
      }

      const fileName = `${document.id}.${fileExt}`
      console.log('Uploading document to S3:', {
        bucket: s3Bucket,
        fileName,
        fileSize: file.size,
        fileType: file.type,
        userId: user.id,
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      })

      // Upload to S3
      const s3Key = await uploadToS3('documents', user.id, fileName, file, file.type)
      console.log('Document uploaded to S3, key:', s3Key)

      // Get public URL (CloudFront or S3)
      const publicUrl = getPublicUrl('documents', s3Key)
      console.log('Document public URL:', publicUrl)

      // Update document with URL and trigger processing
      const { error: updateError } = await serviceClient
        .from('documents')
        .update({
          file_url: publicUrl,
          status: 'processing',
        })
        .eq('id', document.id)

      if (updateError) {
        console.error('Error updating document with file URL:', updateError)
        throw new Error(`Failed to update document: ${updateError.message}`)
      }

      console.log('Document record updated with file URL')
    } catch (uploadError: any) {
      console.error('S3 upload error:', {
        error: uploadError.message,
        stack: uploadError.stack,
        documentId: document.id,
      })
      
      // Update document status to error
      await serviceClient
        .from('documents')
        .update({ status: 'error' })
        .eq('id', document.id)
        .catch((updateError) => {
          console.error('Failed to update document status to error:', updateError)
        })

      return NextResponse.json(
        { 
          error: 'Failed to upload file',
          message: uploadError.message || 'Unknown error',
          details: 'Check AWS credentials and S3 bucket configuration. See server logs for details.'
        },
        { status: 500 }
      )
    }

    // Trigger Supabase Edge Function to process text
    // Process in background (don't await to return quickly to user)
    // The Edge Function has retry logic to handle files that aren't immediately available
    processDocument(document.id, { waitForCompletion: false })
      .then(() => {
        console.log('Document processed successfully by Edge function')
      })
      .catch((error) => {
        console.error('Document processing error:', error)
        // Update document status to error if processing fails
        serviceClient
          .from('documents')
          .update({ status: 'error' })
          .eq('id', document.id)
          .catch((updateError) => {
            console.error('Failed to update document status:', updateError)
          })
      })

    return NextResponse.json({ documentId: document.id })
  } catch (error: any) {
    console.error('Document upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload document' },
      { status: 500 }
    )
  }
}

