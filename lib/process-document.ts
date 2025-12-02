"use server"
import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import mammoth from 'mammoth'
import { Book } from 'epubjs'
import { Buffer } from 'buffer'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Process a document: download, extract text, chunk, and detect language
 * This runs in Node.js runtime using unpdf (for PDFs) and epubjs (pure JavaScript libraries)
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

    // Extract text based on file type
    let extractedText = ''
    let pageCount = 0

    try {
      if (document.file_type === 'pdf') {
        console.log('Extracting text from PDF using unpdf...', {
          bufferSize: fileBuffer.length,
          fileType: document.file_type,
        })
        
        // Use unpdf - a simpler wrapper around pdfjs-dist that works better in serverless
        const { extractText } = await import('unpdf')
        const uint8Array = new Uint8Array(fileBuffer)
        
        console.log('Calling unpdf.extractText...')
        const result = await extractText(uint8Array, { mergePages: true })
        
        extractedText = result.text || ''
        // Get page count from result
        pageCount = result.totalPages || 1
        
        console.log('PDF text extracted:', {
          pages: pageCount,
          textLength: extractedText.length,
          first100Chars: extractedText.substring(0, 100),
        })
        
        if (!extractedText || extractedText.trim().length === 0) {
          console.warn('PDF extraction returned empty text, but no error was thrown')
          console.warn('This might indicate the PDF has no extractable text (e.g., scanned images)')
        }
      } else if (document.file_type === 'docx') {
        console.log('Extracting text from DOCX...', {
          bufferSize: fileBuffer.length,
          fileType: document.file_type,
        })
        const result = await mammoth.extractRawText({ buffer: fileBuffer })
        extractedText = result.value || ''
        // Estimate page count (roughly 500 words per page)
        const wordCount = extractedText.split(/\s+/).filter((w: string) => w.length > 0).length
        pageCount = Math.max(1, Math.ceil(wordCount / 500))
        console.log('DOCX text extracted, estimated pages:', pageCount, 'text length:', extractedText.length)
        
        if (!extractedText || extractedText.trim().length === 0) {
          console.warn('DOCX extraction returned empty text, but no error was thrown')
        }
      } else if (document.file_type === 'epub') {
        console.log('Extracting text from EPUB using epubjs...', {
          bufferSize: fileBuffer.length,
          fileType: document.file_type,
        })
        
        // epubjs needs a URL, so we'll write to a temp file and use file:// URL
        const tempFilePath = join(tmpdir(), `epub-${documentId}-${Date.now()}.epub`)
        const fileUrl = `file://${tempFilePath}`
        
        try {
          // Write buffer to temporary file
          await writeFile(tempFilePath, fileBuffer)
          
          // Create book from file URL
          const book = new Book(fileUrl)
          
          // Wait for book to be ready
          await book.ready
          
          // Get all sections from the spine
          const spine = book.spine
          let fullText = ''
          
          // epubjs spine has a 'spineItems' array we can iterate
          // Use the spine's internal structure to get items
          const spineLength = (spine as any).spineItems?.length || 0
          
          for (let i = 0; i < spineLength; i++) {
            try {
              const item = (spine as any).spineItems[i]
              if (item && item.href) {
                const section = await book.load(item.href)
                if (section) {
                  // Get the content - epubjs returns rendered content
                  let content = ''
                  if (typeof section === 'string') {
                    content = section
                  } else {
                    // Try to extract text from the section object
                    const sectionDoc = (section as any).document
                    if (sectionDoc && sectionDoc.body) {
                      content = sectionDoc.body.textContent || sectionDoc.body.innerHTML || ''
                    } else {
                      content = String(section)
                    }
                  }
                  
                  // Clean up HTML tags
                  const text = content
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                  
                  if (text) {
                    fullText += text + '\n\n'
                  }
                }
              }
            } catch (sectionError: any) {
              console.warn('Error loading EPUB section:', sectionError.message)
              // Continue with other sections
            }
          }
          
          extractedText = fullText.trim()
          
          // Estimate page count
          const wordCount = extractedText.split(/\s+/).filter((w: string) => w.length > 0).length
          pageCount = Math.max(1, Math.ceil(wordCount / 500))
          console.log('EPUB text extracted, estimated pages:', pageCount, 'text length:', extractedText.length)
        } finally {
          // Clean up temporary file
          try {
            await unlink(tempFilePath)
          } catch (cleanupError) {
            console.warn('Failed to delete temporary EPUB file:', cleanupError)
          }
        }
      } else {
        throw new Error(`Unsupported file type: ${document.file_type}`)
      }
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
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY
      if (OPENAI_API_KEY) {
        const sample = extractedText.slice(0, 1000).trim()
        if (sample && sample.length >= 10) {
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

          if (response.ok) {
            const data = await response.json()
            const detected = data.choices?.[0]?.message?.content?.trim().toLowerCase()
            if (detected && detected.length === 2) {
              detectedLanguage = detected
            }
          }
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

