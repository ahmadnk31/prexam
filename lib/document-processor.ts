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
    throw new Error(`Invalid SUPABASE_FUNCTION_URL format. Expected https://{project-ref}.supabase.co/functions/v1/{function-name} or https://{project-ref}.functions.supabase.co/{function-name}, got: ${SUPABASE_FUNCTION_URL}`)
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

  // Handle different Supabase Edge Function URL formats:
  // Format 1: https://{project-ref}.supabase.co/functions/v1/{function-name}
  // Format 2: https://{project-ref}.functions.supabase.co/{function-name} (old)
  // The function name IS the endpoint - don't append additional paths
  
  let functionUrl: string
  const baseUrl = SUPABASE_FUNCTION_URL.replace(/\/$/, '')
  
  // Check if URL already includes a function name
  if (baseUrl.includes('/functions/v1/')) {
    const afterV1 = baseUrl.split('/functions/v1/')[1]
    if (afterV1 && afterV1.trim().length > 0) {
      // URL already includes function name - use as-is
      // The function name (e.g., "process-document" or "smart-task") is the endpoint
      functionUrl = baseUrl
    } else {
      // Just /functions/v1/, need to add function name
      functionUrl = `${baseUrl}/process-document`
    }
  } else if (baseUrl.includes('.functions.supabase.co')) {
    // Old format: https://{project-ref}.functions.supabase.co
    // Check if it already has a function name
    const afterDomain = baseUrl.split('.functions.supabase.co/')[1]
    if (afterDomain && afterDomain.trim().length > 0) {
      functionUrl = baseUrl
    } else {
      functionUrl = `${baseUrl}/process-document`
    }
  } else if (baseUrl.includes('.supabase.co')) {
    // New format base: https://{project-ref}.supabase.co
    functionUrl = `${baseUrl}/functions/v1/process-document`
  } else {
    // Unknown format, try appending
    functionUrl = `${baseUrl}/process-document`
  }
  
  console.log('Constructed function URL:', {
    original: SUPABASE_FUNCTION_URL,
    baseUrl,
    functionUrl,
  })

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

