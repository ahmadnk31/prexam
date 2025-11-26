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

  const response = await fetch(`${SUPABASE_FUNCTION_URL}/process-document`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  let data: any = null
  try {
    data = await response.json()
  } catch (error) {
    console.error('Failed to parse process-document response:', error)
  }

  if (!response.ok) {
    const message = data?.error || 'Failed to trigger document processing'
    throw new Error(message)
  }

  return data
}

