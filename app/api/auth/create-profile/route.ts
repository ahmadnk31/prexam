import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // Verify the user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, email, fullName } = await req.json()

    // Verify the userId matches the authenticated user
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceClient()

    // Check if profile already exists
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      // Update existing profile
      const { error } = await serviceClient
        .from('profiles')
        .update({
          email,
          full_name: fullName,
        })
        .eq('id', userId)

      if (error) {
        console.error('Profile update error:', error)
        return NextResponse.json(
          { error: 'Failed to update profile', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, message: 'Profile updated' })
    }

    // Create new profile
    const { error } = await serviceClient.from('profiles').insert({
      id: userId,
      email,
      full_name: fullName,
    })

    if (error) {
      console.error('Profile creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create profile', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Profile created' })
  } catch (error: any) {
    console.error('Create profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

