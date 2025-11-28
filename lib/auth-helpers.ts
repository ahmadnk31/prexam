import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Check if user is authenticated and email is verified
 * Redirects to login if not authenticated
 * Redirects to verify-email if email is not verified
 */
export async function requireVerifiedEmail() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile to check email_verified status
  const { data: profile } = await supabase
    .from('profiles')
    .select('email_verified')
    .eq('id', user.id)
    .single()

  // Check if email is verified - require verification in either auth.users or profiles
  const isEmailVerified = !!(user.email_confirmed_at || profile?.email_verified)

  if (!isEmailVerified) {
    redirect('/verify-email?message=Please verify your email address to access the dashboard')
  }

  return { user, profile }
}

/**
 * Check if user is authenticated (without email verification requirement)
 */
export async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { user }
}

