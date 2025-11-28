import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Handle missing env vars during build
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    // During build or if env vars are missing, just pass through
    // The actual routes will handle authentication
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect dashboard routes - require authentication and email verification
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    
    // Check if email is verified - redirect to verification page if not
    if (!user.email_confirmed_at) {
      const url = request.nextUrl.clone()
      url.pathname = '/verify-email'
      url.searchParams.set('message', 'Please verify your email address to access the dashboard')
      return NextResponse.redirect(url)
    }
  }

  // Redirect authenticated users away from auth pages
  if (
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup') &&
    user
  ) {
    const url = request.nextUrl.clone()
    // Check if email is verified before redirecting to dashboard
    // We'll check profiles table in the dashboard layout for more accurate status
    if (!user.email_confirmed_at) {
      url.pathname = '/verify-email'
      url.searchParams.set('message', 'Please verify your email address to continue')
    } else {
      url.pathname = '/dashboard/library'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
