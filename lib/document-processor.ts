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
    const missing = []
    if (!SUPABASE_FUNCTION_URL) missing.push('SUPABASE_FUNCTION_URL')
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    throw new Error(`Supabase Edge function configuration missing: ${missing.join(', ')}. Please set these environment variables.`)
  }

  // Validate URL format
  if (!SUPABASE_FUNCTION_URL.startsWith('http://') && !SUPABASE_FUNCTION_URL.startsWith('https://')) {
    throw new Error(`Invalid SUPABASE_FUNCTION_URL format. Expected https://{project-ref}.functions.supabase.co, got: ${SUPABASE_FUNCTION_URL}`)
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
  // Supabase Edge Functions URL format: https://{project-ref}.functions.supabase.co/{function-name}
  const functionUrl = `${baseUrl}/process-document`
  
  // Validate the function URL looks correct
  if (!functionUrl.includes('.functions.supabase.co')) {
    console.warn('Function URL does not match expected Supabase Edge Functions format:', functionUrl)
  }

  console.log('Invoking Supabase Edge function:', {
    url: functionUrl,
    documentId,
    waitForCompletion: options.waitForCompletion,
    hasSecret: !!DOCUMENT_PROCESSING_SECRET,
    baseUrl,
  })

  try {
    console.log('Sending fetch request to:', functionUrl)
    console.log('Request headers:', Object.keys(headers))
    console.log('Request payload:', { documentId, waitForCompletion: options.waitForCompletion })
    const fetchStartTime = Date.now()
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    
    const fetchTime = Date.now() - fetchStartTime
    console.log('Fetch completed in', fetchTime, 'ms, status:', response.status)

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
    // Provide more helpful error messages
    let errorMessage = error.message || 'Unknown error'
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = `Network error: Unable to reach Edge Function at ${functionUrl}. Check if the function is deployed and the URL is correct.`
    } else if (error.message?.includes('Failed to fetch')) {
      errorMessage = `Failed to connect to Edge Function. Possible causes: 1) Function not deployed, 2) Incorrect URL, 3) Network/CORS issue. URL: ${functionUrl}`
    } else if (error.message?.includes('timeout')) {
      errorMessage = `Edge Function request timed out. The function may be taking too long or not responding.`
    }
    
    console.error('Failed to invoke Edge function:', {
      error: errorMessage,
      originalError: error.message,
      name: error.name,
      stack: error.stack,
      url: functionUrl,
      baseUrl: SUPABASE_FUNCTION_URL,
    })
    
    throw new Error(errorMessage)
  }
}

