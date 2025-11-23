import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const videoId = searchParams.get('videoId')

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('summaries')
      .select('content')
      .eq('video_id', videoId)
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 })
    }

    return NextResponse.json({ content: data?.content || null })
  } catch (error: any) {
    console.error('Error loading summary:', error)
    return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 })
  }
}

