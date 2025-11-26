/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js'
import { S3Client, GetObjectCommand } from 'npm:@aws-sdk/client-s3'
import mammoth from 'npm:mammoth'
import epub from 'npm:epub2'
import { Readable } from 'node:stream'
import { Buffer } from 'node:buffer'

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

async function bufferFromStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
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

  const stream = response.Body as ReadableStream<Uint8Array>
  return bufferFromStream(stream)
}

let pdfParseModule: any | null = null

async function getPdfParse() {
  if (!pdfParseModule) {
    const imported = await import('npm:pdf-parse')
    pdfParseModule = imported.default ?? imported
  }
  return pdfParseModule
}

async function extractPDFText(fileBuffer: Buffer) {
  const pdfParse = await getPdfParse()
  const data = await pdfParse(fileBuffer)
  return {
    text: data.text,
    pageCount: data.numpages || 1,
  }
}

async function extractWordText(fileBuffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer: fileBuffer })
  const wordCount = result.value.split(/\s+/).length
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 500))
  return {
    text: result.value,
    pageCount: estimatedPages,
  }
}

async function extractEPUBText(fileBuffer: Buffer) {
  return new Promise<{ text: string; pageCount: number }>((resolve, reject) => {
    try {
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
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (docError || !document) {
    throw new Error('Document not found')
  }

  if (!document.file_url) {
    throw new Error('Document file URL not found')
  }

  let fileBuffer: Buffer
  try {
    const s3Key = extractS3KeyFromUrl(document.file_url)
    if (s3Key) {
      fileBuffer = await downloadFromS3(s3Key)
    } else {
      const fileResponse = await fetch(document.file_url)
      if (!fileResponse.ok) {
        throw new Error('Failed to download document file')
      }
      const arrayBuffer = await fileResponse.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
    }
  } catch (downloadError: any) {
    console.error('Document download error:', downloadError)
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

  await supabase
    .from('documents')
    .update({
      extracted_text: extractedText,
      page_count: pageCount,
      language: detectedLanguage,
      status: 'ready',
    })
    .eq('id', documentId)

  return {
    success: true,
    documentId,
    textLength: extractedText.length,
    chunksCount: chunks.length,
    pageCount,
    language: detectedLanguage,
  }
}

serve(async (req) => {
  if (DOCUMENT_PROCESSING_SECRET) {
    const providedSecret = req.headers.get('x-process-secret')
    if (providedSecret !== DOCUMENT_PROCESSING_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { documentId, waitForCompletion = false } = await req.json()

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId is required' }), { status: 400 })
    }

    if (waitForCompletion) {
      const result = await processDocument(documentId)
      return new Response(JSON.stringify(result), { status: 200 })
    }

    processDocument(documentId)
      .then((result) => {
        console.log('Document processed:', result)
      })
      .catch((error) => {
        console.error('Background processing error:', error)
      })

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        documentId,
        message: 'Document processing started',
      }),
      { status: 202 }
    )
  } catch (error: any) {
    console.error('Process document function error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Failed to process document' }), {
      status: 500,
    })
  }
})


