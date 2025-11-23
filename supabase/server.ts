import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Note: Server clients can't be true singletons because they depend on cookies
// which are request-specific. But we can cache the URL/key lookup.
let cachedUrl: string | null = null
let cachedKey: string | null = null

function getSupabaseConfig() {
  if (cachedUrl && cachedKey) {
    return { url: cachedUrl, key: cachedKey }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  cachedUrl = url
  cachedKey = key
  return { url, key }
}

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const { url, key } = getSupabaseConfig()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

