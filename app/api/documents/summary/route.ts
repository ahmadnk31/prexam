import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      )
    }

    const { data: summary, error } = await supabase
      .from('summaries')
      .select('content')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No summary found
        return NextResponse.json({
          content: null,
        })
      }
      console.error('Error fetching summary:', error)
      return NextResponse.json(
        { error: 'Failed to fetch summary' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      content: summary?.content || null,
    })
  } catch (error) {
    console.error('Error in summary route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

