const SUPABASE_FUNCTION_URL = process.env.SUPABASE_FUNCTION_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const DOCUMENT_PROCESSING_SECRET = process.env.DOCUMENT_PROCESSING_SECRET || ''

if (!SUPABASE_FUNCTION_URL) {
  console.warn('SUPABASE_FUNCTION_URL is not set. Document processing will fail.')
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. Document processing will fail.')
}

interface ProcessDocumentOptions {
  waitForCompletion?: boolean
}

export async function processDocument(
  documentId: string,
  options: ProcessDocumentOptions = {}
) {
  if (!SUPABASE_FUNCTION_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase Edge function configuration missing. Check SUPABASE_FUNCTION_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  const payload = {
    documentId,
    waitForCompletion: options.waitForCompletion ?? false,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  }

  if (DOCUMENT_PROCESSING_SECRET) {
    headers['x-process-secret'] = DOCUMENT_PROCESSING_SECRET
  }

  // Ensure URL doesn't have trailing slash
  const baseUrl = SUPABASE_FUNCTION_URL.replace(/\/$/, '')
  const functionUrl = `${baseUrl}/process-document`

  console.log('Invoking Supabase Edge function:', {
    url: functionUrl,
    documentId,
    waitForCompletion: options.waitForCompletion,
  })

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    console.log('Edge function response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })

    let data: any = null
    try {
      const text = await response.text()
      if (text) {
        data = JSON.parse(text)
      }
    } catch (error) {
      console.error('Failed to parse process-document response:', error)
      throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    if (!response.ok) {
      const message = data?.error || `Edge function returned ${response.status}: ${response.statusText}`
      console.error('Edge function error:', message, data)
      throw new Error(message)
    }

    console.log('Edge function success:', data)
    return data
  } catch (error: any) {
    console.error('Failed to invoke Edge function:', {
      error: error.message,
      stack: error.stack,
      url: functionUrl,
    })
    throw error
  }
}

