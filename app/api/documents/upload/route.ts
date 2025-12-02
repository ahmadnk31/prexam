import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'
import { uploadToS3, getPublicUrl } from '@/lib/s3'
import { processDocumentAction } from '@/lib/process-document'

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
    let documentPublicUrl: string = ''
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
      documentPublicUrl = getPublicUrl('documents', s3Key)
      console.log('Document public URL:', documentPublicUrl)

      // Update document with URL and trigger processing
      const { error: updateError } = await serviceClient
        .from('documents')
        .update({
          file_url: documentPublicUrl,
          status: 'processing',
        })
        .eq('id', document.id)

      if (updateError) {
        console.error('Error updating document with file URL:', updateError)
        throw new Error(`Failed to update document: ${updateError.message}`)
      }

      console.log('Document record updated with file URL:', documentPublicUrl)
    } catch (uploadError: any) {
      console.error('S3 upload error:', {
        error: uploadError.message,
        stack: uploadError.stack,
        documentId: document.id,
      })
      
      // Update document status to error
      try {
        await serviceClient
          .from('documents')
          .update({ status: 'error' })
          .eq('id', document.id)
      } catch (updateError: any) {
        console.error('Failed to update document status to error:', updateError)
      }

      return NextResponse.json(
        { 
          error: 'Failed to upload file',
          message: uploadError.message || 'Unknown error',
          details: 'Check AWS credentials and S3 bucket configuration. See server logs for details.'
        },
        { status: 500 }
      )
    }

    // Process document text extraction in background (Node.js runtime)
    // This uses pdf-parse, mammoth, and epub2 which work properly in Node.js runtime
    if (!documentPublicUrl) {
      console.error('Document public URL is missing, cannot process document')
      return NextResponse.json(
        { error: 'Failed to get document URL' },
        { status: 500 }
      )
    }
    
    console.log('Triggering document processing:', {
      documentId: document.id,
      fileUrl: documentPublicUrl,
    })
    
    // Process in background - ensure it runs even after response is sent
    // Use a fire-and-forget pattern that works in Vercel's serverless environment
    ;(async () => {
      try {
        // Small delay for S3 eventual consistency
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        console.log('Starting background document processing for:', document.id)
        const result = await processDocumentAction(document.id)
        console.log('Document processed successfully:', {
          documentId: result.documentId,
          success: result.success,
          textLength: result.textLength,
          chunksCount: result.chunksCount,
        })
      } catch (error: any) {
        console.error('Document processing error:', {
          documentId: document.id,
          error: error.message,
          stack: error.stack,
        })
        // Status is already updated to error in processDocumentAction
      }
    })().catch((error) => {
      console.error('Unhandled error in background processing:', error)
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

