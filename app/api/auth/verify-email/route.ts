import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const token = searchParams.get('token')
    const email = searchParams.get('email')

    if (!token || !email) {
      return NextResponse.redirect(
        new URL('/verify-email?error=invalid_token', req.url)
      )
    }

    const supabase = await createClient()
    const serviceClient = createServiceClient()

    // Verify the token
    const { data: user } = await supabase.auth.getUser()
    
    if (!user.user) {
      // Try to find user by email
      const { data: users } = await serviceClient.auth.admin.listUsers()
      const targetUser = users.users.find((u) => u.email === email)
      
      if (!targetUser) {
        return NextResponse.redirect(
          new URL('/verify-email?error=user_not_found', req.url)
        )
      }

      // Verify token matches
      const expectedToken = crypto
        .createHash('sha256')
        .update(`${targetUser.id}${email}${process.env.EMAIL_VERIFICATION_SECRET || 'default-secret'}`)
        .digest('hex')

      if (token !== expectedToken) {
        return NextResponse.redirect(
          new URL('/verify-email?error=invalid_token', req.url)
        )
      }

      // Update user email confirmation status
      await serviceClient.auth.admin.updateUserById(targetUser.id, {
        email_confirm: true,
      })

      // Also update profiles.email_verified
      await serviceClient
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', targetUser.id)

      return NextResponse.redirect(
        new URL('/verify-email?success=true', req.url)
      )
    } else {
      // User is logged in, verify token
      const expectedToken = crypto
        .createHash('sha256')
        .update(`${user.user.id}${email}${process.env.EMAIL_VERIFICATION_SECRET || 'default-secret'}`)
        .digest('hex')

      if (token !== expectedToken) {
        return NextResponse.redirect(
          new URL('/verify-email?error=invalid_token', req.url)
        )
      }

      // Update user email confirmation status
      await serviceClient.auth.admin.updateUserById(user.user.id, {
        email_confirm: true,
      })

      // Also update profiles.email_verified
      await serviceClient
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', user.user.id)

      return NextResponse.redirect(
        new URL('/verify-email?success=true', req.url)
      )
    }
  } catch (error: any) {
    console.error('Email verification error:', error)
    return NextResponse.redirect(
      new URL('/verify-email?error=verification_failed', req.url)
    )
  }
}

