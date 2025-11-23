import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClientInstance: SupabaseClient | null = null

function getBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    if (typeof window === 'undefined') {
      // During SSR/build, return placeholder to allow build to succeed
      return {
        url: 'https://placeholder.supabase.co',
        key: 'placeholder-key',
      }
    }
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return { url, key }
}

export function createClient(): SupabaseClient {
  // Browser client can be a true singleton
  if (browserClientInstance) {
    return browserClientInstance
  }

  const { url, key } = getBrowserConfig()
  browserClientInstance = createBrowserClient(url, key)
  return browserClientInstance
}

