/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js'
import { S3Client, GetObjectCommand } from 'npm:@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { Buffer } from 'node:buffer'

// IMPORTANT: Set up polyfills BEFORE importing mammoth/epub
// These libraries may use DOMMatrix during module initialization
// Polyfill DOMMatrix and other DOM APIs for Deno environment
// These are needed by mammoth and other libraries that expect browser APIs
if (typeof globalThis.DOMMatrix === 'undefined') {
  // Comprehensive DOMMatrix polyfill
  const DOMMatrixImpl = class DOMMatrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    m11 = 1
    m12 = 0
    m21 = 0
    m22 = 1
    m41 = 0
    m42 = 0
    m13 = 0
    m14 = 0
    m23 = 0
    m24 = 0
    m31 = 0
    m32 = 0
    m33 = 1
    m34 = 0
    m43 = 0
    m44 = 1
    
    constructor(init?: string | number[] | DOMMatrix) {
      // Handle different constructor arguments
      if (typeof init === 'string') {
        // Parse matrix string if provided
        // For now, just use identity matrix
      } else if (Array.isArray(init)) {
        // Handle array of numbers
        if (init.length >= 6) {
          this.a = init[0] || 1
          this.b = init[1] || 0
          this.c = init[2] || 0
          this.d = init[3] || 1
          this.e = init[4] || 0
          this.f = init[5] || 0
        }
      } else if (init) {
        // Copy from another DOMMatrix
        Object.assign(this, init)
      }
    }
    
    static fromMatrix(other?: DOMMatrix) {
      return new DOMMatrixImpl(other as any)
    }
    
    static fromFloat32Array(array32: Float32Array) {
      return new DOMMatrixImpl(Array.from(array32))
    }
    
    static fromFloat64Array(array64: Float64Array) {
      return new DOMMatrixImpl(Array.from(array64))
    }
    
    translateSelf(tx = 0, ty = 0, tz = 0) {
      this.e += tx
      this.f += ty
      return this
    }
    
    scaleSelf(scaleX = 1, scaleY = scaleX, scaleZ = 1, originX = 0, originY = 0, originZ = 0) {
      this.a *= scaleX
      this.d *= scaleY
      return this
    }
    
    rotateSelf(rotX = 0, rotY = 0, rotZ = 0) {
      // Simplified rotation - just return this for now
      return this
    }
    
    multiply(other: DOMMatrix) {
      return new DOMMatrixImpl(this)
    }
    
    invertSelf() {
      return this
    }
    
    setMatrixValue(transformList: string) {
      // Parse CSS transform string - simplified
      return this
    }
  }
  
  globalThis.DOMMatrix = DOMMatrixImpl as any
  console.log('DOMMatrix polyfill installed')
}

// Polyfill DOMParser if needed
if (typeof globalThis.DOMParser === 'undefined') {
  // Minimal DOMParser polyfill
  globalThis.DOMParser = class DOMParser {
    parseFromString(source: string, mimeType: string) {
      return {
        documentElement: {
          getElementsByTagName: () => [],
          querySelector: () => null,
          querySelectorAll: () => [],
        },
      } as any
    }
  } as any
}

// Lazy load pdfjs-dist - a Deno-compatible PDF library
let pdfjsLib: any = null

async function getPdfJs() {
  if (!pdfjsLib) {
    try {
      console.log('Loading pdfjs-dist...')
      // Import pdfjs-dist standard build
      const pdfjsModule = await import('npm:pdfjs-dist@4.0.379/build/pdf.mjs')
      
      // pdfjs-dist exports getDocument from the module
      pdfjsLib = pdfjsModule
      
      // Configure worker source - use jsDelivr CDN which should work in Edge Functions
      if (pdfjsLib.GlobalWorkerOptions) {
        // Use the minified worker from CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs'
        console.log('Worker source configured:', pdfjsLib.GlobalWorkerOptions.workerSrc)
      } else {
        console.warn('GlobalWorkerOptions not found in pdfjs-dist module')
      }
      
      console.log('pdfjs-dist loaded successfully')
    } catch (error: any) {
      console.error('Error loading pdfjs-dist:', {
        message: error.message,
        stack: error.stack,
      })
      throw new Error(`Failed to load pdfjs-dist: ${error.message}`)
    }
  }
  return pdfjsLib
}

// Lazy load mammoth and epub after polyfills are set up
let mammothModule: any = null
let epubModule: any = null

async function getMammoth() {
  if (!mammothModule) {
    mammothModule = await import('npm:mammoth')
    mammothModule = mammothModule.default || mammothModule
  }
  return mammothModule
}

async function getEpub() {
  if (!epubModule) {
    epubModule = await import('npm:epub2')
    epubModule = epubModule.default || epubModule
  }
  return epubModule
}

type DocumentRecord = {
  id: string
  file_url: string
  file_type: 'pdf' | 'docx' | 'epub'
  user_id: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const AWS_REGION = Deno.env.get('AWS_REGION') ?? 'us-east-1'
const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
const AWS_S3_BUCKET = Deno.env.get('AWS_S3_BUCKET') ?? ''
const CLOUDFRONT_DOMAIN = Deno.env.get('AWS_CLOUDFRONT_DOMAIN') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const DOCUMENT_PROCESSING_SECRET = Deno.env.get('DOCUMENT_PROCESSING_SECRET') ?? ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase configuration')
}

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
  console.error('Missing AWS S3 configuration')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
})

function bufferToStream(buffer: Buffer) {
  return Readable.from(buffer)
}

async function bufferFromStream(body: any): Promise<Buffer> {
  // Handle Uint8Array directly (fastest path)
  if (body instanceof Uint8Array) {
    return Buffer.from(body)
  }

  // Handle Blob
  if (body instanceof Blob) {
    const arrayBuffer = await body.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  // Handle Node.js Readable stream FIRST (before transformToWebStream to avoid CRC32 errors)
  // AWS SDK v3 in Deno often returns a Node.js stream that has .on() method
  if (body && typeof body.on === 'function') {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      body.on('data', (chunk: Buffer) => chunks.push(chunk))
      body.on('end', () => resolve(Buffer.concat(chunks)))
      body.on('error', reject)
    })
  }

  // Handle Web ReadableStream (if it's already a Web stream)
  if (body && typeof body.getReader === 'function') {
    const chunks: Uint8Array[] = []
    const reader = body.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  }

  // Last resort: try transformToWebStream (but this may trigger CRC32 errors in Deno)
  // Only use if none of the above methods work
  if (body && typeof body.transformToWebStream === 'function') {
    try {
      const webStream = body.transformToWebStream()
      const chunks: Uint8Array[] = []
      const reader = webStream.getReader()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    } catch (error) {
      console.error('Error using transformToWebStream (CRC32 issue in Deno):', error)
      // If transformToWebStream fails, try reading as Node stream if it has readable properties
      if (body && typeof body.read === 'function') {
        const chunks: Buffer[] = []
        let chunk: Buffer | null
        while ((chunk = body.read()) !== null) {
          chunks.push(chunk)
        }
        return Buffer.concat(chunks)
      }
      throw new Error(`Failed to read stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  throw new Error(`Unsupported body type: ${typeof body}, constructor: ${body?.constructor?.name}`)
}

function extractS3KeyFromUrl(url: string): string | null {
  if (CLOUDFRONT_DOMAIN && url.includes(CLOUDFRONT_DOMAIN)) {
    const domain = CLOUDFRONT_DOMAIN.replace(/\/$/, '')
    const domainWithProtocol = domain.startsWith('http') ? domain : `https://${domain}`
    return url.replace(domainWithProtocol, '').replace(/^\//, '')
  }

  const s3Pattern = /https?:\/\/([^/]+)\.s3[^/]*\.amazonaws\.com\/(.+)$/
  const match = url.match(s3Pattern)
  if (match) {
    return match[2]
  }

  return null
}

async function downloadFromS3(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: s3Key,
  })

  const response = await s3Client.send(command)
  if (!response.Body) {
    throw new Error('No data returned from S3')
  }

  console.log('S3 response body type:', typeof response.Body, response.Body.constructor?.name)
  
  // Pass the body directly - bufferFromStream will handle different types
  try {
    return await bufferFromStream(response.Body)
  } catch (error: any) {
    console.error('Error converting S3 body to buffer:', error)
    console.error('Body type details:', {
      type: typeof response.Body,
      constructor: response.Body?.constructor?.name,
      hasGetReader: typeof (response.Body as any)?.getReader === 'function',
      hasOn: typeof (response.Body as any)?.on === 'function',
      hasTransformToWebStream: typeof (response.Body as any)?.transformToWebStream === 'function',
      isBlob: response.Body instanceof Blob,
      isUint8Array: response.Body instanceof Uint8Array,
    })
    throw error
  }
}

async function extractPDFText(fileBuffer: Buffer) {
  try {
    const pdfjs = await getPdfJs()
    
    console.log('Loading PDF with pdfjs-dist, buffer size:', fileBuffer.length)
    
    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(fileBuffer)
    
    // Get getDocument function - it might be in different locations
    const getDocument = pdfjs.getDocument || pdfjs.default?.getDocument || (pdfjs as any).getDocument
    
    if (!getDocument || typeof getDocument !== 'function') {
      console.error('getDocument not found in pdfjs-dist:', {
        keys: Object.keys(pdfjs),
        hasDefault: !!pdfjs.default,
        defaultKeys: pdfjs.default ? Object.keys(pdfjs.default) : null,
      })
      throw new Error('getDocument function not found in pdfjs-dist')
    }
    
    // Load the PDF document
    const loadingTask = getDocument({ data: uint8Array })
    const pdfDocument = await loadingTask.promise
    const numPages = pdfDocument.numPages
    
    console.log('PDF loaded, pages:', numPages)
    
    // Extract text from all pages
    let fullText = ''
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Combine text items from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      
      fullText += pageText + '\n\n'
    }
    
    console.log('PDF text extraction completed, text length:', fullText.length)
    
    return {
      text: fullText.trim(),
      pageCount: numPages,
    }
  } catch (error: any) {
    console.error('extractPDFText error:', {
      error: error.message,
      stack: error.stack,
      bufferSize: fileBuffer.length,
    })
    throw error
  }
}

async function extractWordText(fileBuffer: Buffer) {
  // Load mammoth after polyfills are set up
  const mammoth = await getMammoth()
  const result = await mammoth.extractRawText({ buffer: fileBuffer })
  const wordCount = result.value.split(/\s+/).length
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 500))
  return {
    text: result.value,
    pageCount: estimatedPages,
  }
}

async function extractEPUBText(fileBuffer: Buffer) {
  return new Promise<{ text: string; pageCount: number }>(async (resolve, reject) => {
    try {
      // Load epub after polyfills are set up
      const epub = await getEpub()
      const book = new (epub as any)(bufferToStream(fileBuffer))
      let fullText = ''

      book.on('chapter', (chapter: any) => {
        const text = chapter.body
          ? chapter.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          : ''
        if (text) {
          fullText += text + '\n\n'
        }
      })

      book.on('end', () => {
        const wordCount = fullText.split(/\s+/).filter((w: string) => w.length > 0).length
        const estimatedPages = Math.max(1, Math.ceil(wordCount / 500))
        resolve({
          text: fullText.trim(),
          pageCount: estimatedPages,
        })
      })

      book.on('error', (err: Error) => {
        reject(err)
      })

      book.parse()
    } catch (error) {
      reject(error)
    }
  })
}

async function detectLanguage(text: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return 'en'
  }

  const sample = text.slice(0, 1000).trim()
  if (!sample || sample.length < 10) {
    return 'en'
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 10,
        messages: [
          {
            role: 'system',
            content:
              'You are a language detection assistant. Identify the primary language of the given text and respond with only the ISO 639-1 language code (e.g., "en" for English).',
          },
          {
            role: 'user',
            content: `What is the language of this text? Respond with only the ISO 639-1 language code:\n\n${sample}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('OpenAI language detection error:', await response.text())
      return 'en'
    }

    const data = await response.json()
    const detected =
      data.choices?.[0]?.message?.content?.trim().toLowerCase() ??
      'en'

    if (/^[a-z]{2,3}$/.test(detected)) {
      return detected
    }

    return 'en'
  } catch (error) {
    console.error('Language detection error:', error)
    return 'en'
  }
}

async function processDocument(documentId: string) {
  console.log('Starting document processing:', { documentId, timestamp: new Date().toISOString() })
  
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (docError || !document) {
    console.error('Document not found:', { documentId, error: docError })
    throw new Error('Document not found')
  }

  console.log('Document found:', {
    documentId: document.id,
    fileType: document.file_type,
    fileUrl: document.file_url ? 'present' : 'missing',
    status: document.status,
  })

  if (!document.file_url) {
    console.error('Document file URL is missing:', { documentId })
    throw new Error('Document file URL not found')
  }

  let fileBuffer: Buffer
  try {
    // Always use fetch with the public URL to avoid AWS SDK CRC32 checksum issues in Deno
    // The file_url is already a public URL (CloudFront or S3 public URL)
    console.log('Downloading document from URL:', document.file_url)
    
    // Validate URL format
    if (!document.file_url.startsWith('http://') && !document.file_url.startsWith('https://')) {
      throw new Error(`Invalid file URL format: ${document.file_url}`)
    }
    
    // Try downloading with retries (S3 files might not be immediately available)
    let fileResponse: Response | null = null
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Download attempt ${attempt}/3`)
        fileResponse = await fetch(document.file_url, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
          },
        })
        
        if (fileResponse.ok) {
          break
        } else {
          console.warn(`Download attempt ${attempt} failed: ${fileResponse.status} ${fileResponse.statusText}`)
          if (attempt < 3 && fileResponse.status === 404) {
            // Wait a bit before retrying (file might not be immediately available)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
            continue
          }
          throw new Error(`Failed to download document file: ${fileResponse.status} ${fileResponse.statusText}`)
        }
      } catch (fetchError: any) {
        lastError = fetchError
        console.warn(`Download attempt ${attempt} error:`, fetchError.message)
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        throw fetchError
      }
    }
    
    if (!fileResponse || !fileResponse.ok) {
      throw lastError || new Error('Failed to download document after 3 attempts')
    }
    
    const arrayBuffer = await fileResponse.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)
    console.log('Document downloaded successfully, size:', fileBuffer.length, 'bytes')
    
    if (fileBuffer.length === 0) {
      throw new Error('Downloaded file is empty')
    }
  } catch (downloadError: any) {
    console.error('Document download error:', {
      error: downloadError.message,
      stack: downloadError.stack,
      url: document.file_url,
      documentId,
    })
    await supabase
      .from('documents')
      .update({ status: 'error' })
      .eq('id', documentId)
    throw new Error(`Failed to download document: ${downloadError.message || 'Unknown error'}`)
  }

  let extractedText = ''
  let pageCount = 0

  try {
    if (document.file_type === 'pdf') {
      const result = await extractPDFText(fileBuffer)
      extractedText = result.text
      pageCount = result.pageCount
    } else if (document.file_type === 'docx') {
      const result = await extractWordText(fileBuffer)
      extractedText = result.text
      pageCount = result.pageCount
    } else if (document.file_type === 'epub') {
      const result = await extractEPUBText(fileBuffer)
      extractedText = result.text
      pageCount = result.pageCount
    } else {
      throw new Error(`Unsupported file type: ${document.file_type}`)
    }
  } catch (extractError: any) {
    console.error('Text extraction error:', extractError)
    await supabase
      .from('documents')
      .update({ status: 'error' })
      .eq('id', documentId)
    throw new Error(`Failed to extract text from document: ${extractError.message}`)
  }

  if (!extractedText || extractedText.trim().length === 0) {
    await supabase.from('documents').update({ status: 'error' }).eq('id', documentId)
    throw new Error('No text could be extracted from the document')
  }

  const chunkSize = 5000
  const chunks: string[] = []
  for (let i = 0; i < extractedText.length; i += chunkSize) {
    chunks.push(extractedText.slice(i, i + chunkSize))
  }

  if (chunks.length > 0) {
    const chunkInserts = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_index: index,
      content: chunk,
      page_number: document.file_type === 'pdf' ? Math.floor((index / chunks.length) * pageCount) + 1 : null,
    }))

    await supabase.from('document_chunks').delete().eq('document_id', documentId)
    const { error: chunksError } = await supabase.from('document_chunks').insert(chunkInserts)
    if (chunksError) {
      console.error('Error inserting chunks:', chunksError)
    }
  }

  let detectedLanguage = 'en'
  try {
    detectedLanguage = await detectLanguage(extractedText)
  } catch (error) {
    console.error('Error detecting language:', error)
  }

  console.log('Updating document status to ready:', {
    documentId,
    textLength: extractedText.length,
    chunksCount: chunks.length,
    pageCount,
    language: detectedLanguage,
  })

  const { error: updateError } = await supabase
    .from('documents')
    .update({
      extracted_text: extractedText,
      page_count: pageCount,
      language: detectedLanguage,
      status: 'ready',
    })
    .eq('id', documentId)

  if (updateError) {
    console.error('Error updating document status:', updateError)
    throw new Error(`Failed to update document: ${updateError.message}`)
  }

  console.log('Document processing completed successfully:', {
    documentId,
    textLength: extractedText.length,
    chunksCount: chunks.length,
    pageCount,
    language: detectedLanguage,
    timestamp: new Date().toISOString(),
  })

  return {
    success: true,
    documentId,
    textLength: extractedText.length,
    chunksCount: chunks.length,
    pageCount,
    language: detectedLanguage,
  }
}

// Global error handler for unhandled rejections
if (typeof Deno !== 'undefined') {
  globalThis.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    event.preventDefault()
  })
  
  globalThis.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error)
  })
}

serve(async (req) => {
  const requestId = crypto.randomUUID()
  let documentId: string | undefined
  
  try {
    console.log('Edge function invoked:', {
      requestId,
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
    })

    // Health check endpoint
    if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (DOCUMENT_PROCESSING_SECRET) {
      const providedSecret = req.headers.get('x-process-secret')
      if (providedSecret !== DOCUMENT_PROCESSING_SECRET) {
        console.error('Unauthorized: secret mismatch')
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }
    }

    if (req.method !== 'POST') {
      console.error('Method not allowed:', req.method)
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    let body: any
    try {
      const bodyText = await req.text()
      console.log('Request body text:', bodyText)
      body = JSON.parse(bodyText)
      console.log('Request body parsed:', body)
    } catch (parseError: any) {
      console.error('Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', details: parseError.message }),
        { status: 400 }
      )
    }

    try {
      const { documentId: bodyDocumentId, waitForCompletion = false } = body || {}
      documentId = bodyDocumentId

      if (!documentId) {
        console.error('Missing documentId in request body')
        return new Response(JSON.stringify({ error: 'documentId is required' }), { status: 400 })
      }

      // Always wait for completion to ensure processing finishes
      // Supabase Edge Functions may terminate background tasks after response is sent
      console.log('Starting document processing, waitForCompletion:', waitForCompletion)
      const startTime = Date.now()
      
      try {
        const result = await processDocument(documentId)
        const processingTime = Date.now() - startTime
        console.log('Document processing finished:', {
          documentId: result.documentId,
          processingTimeMs: processingTime,
          textLength: result.textLength,
          chunksCount: result.chunksCount,
        })
        
        if (waitForCompletion) {
          return new Response(JSON.stringify(result), { status: 200 })
        } else {
          // Return success immediately, processing is complete
          return new Response(
            JSON.stringify({
              success: true,
              queued: false,
              completed: true,
              documentId: result.documentId,
              message: 'Document processing completed',
            }),
            { status: 200 }
          )
        }
      } catch (error: any) {
        const processingTime = Date.now() - startTime
        console.error('Document processing failed after', processingTime, 'ms:', {
          documentId,
          error: error.message,
          stack: error.stack,
          processingTimeMs: processingTime,
        })
        
        // Update document status to error
        try {
          await supabase
            .from('documents')
            .update({ status: 'error' })
            .eq('id', documentId)
        } catch (updateError: any) {
          console.error('Failed to update document status to error:', updateError)
        }
        
        return new Response(
          JSON.stringify({
            error: 'Failed to process document',
            message: error.message || 'Unknown error',
            documentId,
          }),
          { status: 500 }
        )
      }
    } catch (error: any) {
      console.error('Process document function error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
        documentId,
      })
      
      // Try to update document status to error if we have a documentId
      if (documentId) {
        try {
          await supabase
            .from('documents')
            .update({ status: 'error' })
            .eq('id', documentId)
          console.log('Document status updated to error')
        } catch (updateError: any) {
          console.error('Failed to update document status to error:', updateError)
        }
      }
      
      return new Response(
        JSON.stringify({
          error: 'Failed to process document',
          message: error.message || 'Unknown error',
          documentId: documentId || undefined,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (outerError: any) {
    // Catch any errors that occur outside the main try-catch (e.g., during initialization)
    console.error('Fatal error in Edge Function:', {
      message: outerError.message,
      stack: outerError.stack,
      name: outerError.name,
      requestId,
    })
    
    // Try to update document status if we have it
    if (documentId) {
      try {
        await supabase
          .from('documents')
          .update({ status: 'error' })
          .eq('id', documentId)
      } catch (updateError: any) {
        console.error('Failed to update document status:', updateError)
      }
    }
    
    return new Response(
      JSON.stringify({
        error: 'Fatal error in Edge Function',
        message: outerError.message || 'Unknown error',
        documentId: documentId || undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})


