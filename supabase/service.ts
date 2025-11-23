import { createClient, SupabaseClient } from '@supabase/supabase-js'

let serviceClientInstance: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (serviceClientInstance) {
    return serviceClientInstance
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  serviceClientInstance = createClient(url, key)
  return serviceClientInstance
}

// Export for backward compatibility
export const createServiceClient = getServiceClient

