import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import { openai } from '@/lib/openai'
import { Buffer } from 'buffer'

/**
 * Process a document: download, extract text using OpenAI, chunk, and detect language
 * Uses OpenAI's API to extract text from documents
 * Called from route handlers that have `export const runtime = 'nodejs'`
 */
export async function processDocumentAction(documentId: string) {
  const serviceClient = createServiceClient()
  const supabase = await createClient()

  try {
    console.log('Starting document processing:', { documentId, timestamp: new Date().toISOString() })

    // Get document from database
    const { data: document, error: docError } = await serviceClient
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

    // Download file from S3/CloudFront
    console.log('Downloading document from URL:', document.file_url)
    let fileBuffer: Buffer

    try {
      const fileResponse = await fetch(document.file_url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
      })

      if (!fileResponse.ok) {
        throw new Error(`Failed to download document file: ${fileResponse.status} ${fileResponse.statusText}`)
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
      await serviceClient
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)
      throw new Error(`Failed to download document: ${downloadError.message || 'Unknown error'}`)
    }

    // Extract text using OpenAI
    // For now, we'll use OpenAI to process the document by uploading it and asking for text extraction
    let extractedText = ''
    let pageCount = 0

    try {
      console.log('Extracting text using OpenAI...', {
        bufferSize: fileBuffer.length,
        fileType: document.file_type,
      })

      // Determine file extension and MIME type
      let fileExtension = document.file_type
      let mimeType = 'application/pdf'
      if (document.file_type === 'docx') {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      } else if (document.file_type === 'epub') {
        mimeType = 'application/epub+zip'
      }

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY
      if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set')
      }

      // Upload file to OpenAI using FormData
      console.log('Uploading file to OpenAI...')
      const formData = new FormData()
      // Convert Buffer to Uint8Array for FormData
      const uint8Array = new Uint8Array(fileBuffer)
      const fileBlob = new Blob([uint8Array], { type: mimeType })
      formData.append('file', fileBlob, `document.${fileExtension}`)
      formData.append('purpose', 'assistants')

      const uploadResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('OpenAI file upload error:', errorText)
        throw new Error(`Failed to upload file to OpenAI: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }

      const uploadData = await uploadResponse.json()
      const fileId = uploadData.id
      console.log('File uploaded to OpenAI, file ID:', fileId)

      // Use OpenAI Assistants API to extract text
      // Create a temporary assistant
      const assistant = await openai.beta.assistants.create({
        model: 'gpt-4o',
        instructions: 'You are a document text extraction assistant. Extract all text from the provided document. Preserve structure, paragraphs, and formatting. Return only the extracted text, no additional commentary or explanations.',
        tools: [{ type: 'code_interpreter' }],
      })

      // Create a thread and add the file
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: 'user',
            content: 'Please extract all text from this document. Return the complete text content, preserving the original structure and formatting as much as possible.',
            attachments: [
              {
                file_id: fileId,
                tools: [{ type: 'code_interpreter' }],
              },
            ],
          },
        ],
      })

      // Run the assistant
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      })

      // Wait for completion - poll until done
      let runStatus
      let attempts = 0
      const maxAttempts = 120 // 2 minutes max
      do {
        await new Promise(resolve => setTimeout(resolve, 1000))
        // @ts-ignore - OpenAI SDK type definitions may be incorrect
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id)
        attempts++
        if (attempts > maxAttempts) {
          throw new Error('OpenAI assistant run timed out')
        }
      } while (runStatus.status === 'queued' || runStatus.status === 'in_progress')

      if (runStatus.status !== 'completed') {
        throw new Error(`OpenAI assistant run failed: ${runStatus.status}`)
      }

      // Get the messages
      const messages = await openai.beta.threads.messages.list(thread.id)
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant')
      extractedText = assistantMessage?.content[0]?.type === 'text' 
        ? assistantMessage.content[0].text.value 
        : ''
      
      // Clean up: Delete assistant and file
      try {
        await openai.beta.assistants.delete(assistant.id)
        await openai.files.delete(fileId)
        console.log('Cleaned up OpenAI resources')
      } catch (cleanupError) {
        console.warn('Failed to cleanup OpenAI resources:', cleanupError)
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('OpenAI returned empty text')
      }

      // Estimate page count (roughly 500 words per page)
      const wordCount = extractedText.split(/\s+/).filter((w: string) => w.length > 0).length
      pageCount = Math.max(1, Math.ceil(wordCount / 500))
      
      console.log('Text extracted using OpenAI, estimated pages:', pageCount, 'text length:', extractedText.length)
    } catch (extractError: any) {
      console.error('Text extraction error:', extractError)
      await serviceClient
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)
      throw new Error(`Failed to extract text from document: ${extractError.message}`)
    }

    if (!extractedText || extractedText.trim().length === 0) {
      await serviceClient.from('documents').update({ status: 'error' }).eq('id', documentId)
      throw new Error('No text could be extracted from the document')
    }

    // Chunk the text
    const chunkSize = 5000
    const chunks: string[] = []
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      chunks.push(extractedText.slice(i, i + chunkSize))
    }

    console.log('Text chunked into', chunks.length, 'chunks')

    // Save chunks to database
    if (chunks.length > 0) {
      const chunkInserts = chunks.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: chunk,
      }))

      const { error: chunksError } = await serviceClient
        .from('document_chunks')
        .upsert(chunkInserts, { onConflict: 'document_id,chunk_index' })

      if (chunksError) {
        console.error('Error saving chunks:', chunksError)
        // Don't fail completely if chunks fail - we still have the full text
      }
    }

    // Detect language using OpenAI
    let detectedLanguage = 'en'
    try {
      const sample = extractedText.slice(0, 1000).trim()
      if (sample && sample.length >= 10) {
        const langResponse = await openai.chat.completions.create({
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
        })

        const detected = langResponse.choices?.[0]?.message?.content?.trim().toLowerCase()
        if (detected && detected.length === 2) {
          detectedLanguage = detected
        }
      }
    } catch (langError: any) {
      console.warn('Language detection failed, using default (en):', langError.message)
      // Don't fail if language detection fails
    }

    // Update document with extracted text and status
    const { error: updateError } = await serviceClient
      .from('documents')
      .update({
        extracted_text: extractedText,
        page_count: pageCount,
        language: detectedLanguage,
        status: 'ready',
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Error updating document:', updateError)
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
  } catch (error: any) {
    console.error('Document processing failed:', {
      documentId,
      error: error.message,
      stack: error.stack,
    })

    // Update document status to error
    try {
      await serviceClient
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)
    } catch (updateError: any) {
      console.error('Failed to update document status to error:', updateError)
    }

    throw error
  }
}
