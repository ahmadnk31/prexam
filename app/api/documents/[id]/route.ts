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

    // Verify document ownership
    const { data: document, error: documentError } = await serviceClient
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (documentError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Delete document file from storage if it exists
    if (document.file_url) {
      try {
        // Extract file path from URL
        // Format: https://...supabase.co/storage/v1/object/public/documents/{path}
        const urlParts = document.file_url.split('/documents/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1]
          await serviceClient.storage
            .from('documents')
            .remove([filePath])
        }
      } catch (storageError) {
        // Log but don't fail if storage deletion fails
        console.error('Error deleting document file from storage:', storageError)
      }
    }

    // Delete document record (cascade will handle related records)
    const { error: deleteError } = await serviceClient
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting document:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete document error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

