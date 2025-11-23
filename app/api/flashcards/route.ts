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

    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get('videoId')

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching flashcards:', error)
      return NextResponse.json(
        { error: 'Failed to fetch flashcards' },
        { status: 500 }
      )
    }

    return NextResponse.json({ flashcards: data || [] })
  } catch (error) {
    console.error('Flashcards fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

