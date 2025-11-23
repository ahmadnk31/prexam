import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'

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

    // Upload file to Supabase Storage
    const fileName = `${document.id}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await serviceClient.storage
      .from('documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      
      // Check if it's a bucket not found error
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist')) {
        await serviceClient
          .from('documents')
          .update({ status: 'error' })
          .eq('id', document.id)
        
        return NextResponse.json(
          { 
            error: 'Storage bucket not found',
            message: 'The "documents" bucket does not exist in Supabase Storage. Please create it in your Supabase dashboard under Storage.',
          },
          { status: 500 }
        )
      }
      
      // Update document status to error
      await serviceClient
        .from('documents')
        .update({ status: 'error' })
        .eq('id', document.id)

      return NextResponse.json(
        { 
          error: 'Failed to upload file',
          message: uploadError.message || 'Unknown error',
        },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = serviceClient.storage.from('documents').getPublicUrl(filePath)

    // Update document with URL and trigger processing
    await serviceClient
      .from('documents')
      .update({
        file_url: publicUrl,
        status: 'processing',
      })
      .eq('id', document.id)

    // Trigger text extraction in background (don't wait)
    // Use dynamic import to avoid blocking the response
    import('@/lib/document-processor').then(({ processDocument }) => {
      processDocument(document.id).catch((error) => {
        console.error('Background document processing error:', error)
      })
    }).catch((error) => {
      console.error('Failed to load document processor:', error)
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

