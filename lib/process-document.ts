'use server'

import { createServiceClient } from '@/supabase/service'
import { createClient } from '@/supabase/server'
import { detectLanguage } from '@/lib/language-detection'

export const runtime = 'nodejs'

/**
 * Process a document: download, extract text, chunk, and detect language
 * This is a Server Action that runs in Node.js runtime using unpdf (for PDFs) and mammoth (for DOCX)
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
    let arrayBuffer: ArrayBuffer

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

      arrayBuffer = await fileResponse.arrayBuffer()
      console.log('Document downloaded successfully, size:', arrayBuffer.byteLength, 'bytes')

      if (arrayBuffer.byteLength === 0) {
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
          bufferSize: arrayBuffer.byteLength,
          fileType: document.file_type,
        })
        
        const { extractText } = await import('unpdf')
        const result = await extractText(new Uint8Array(arrayBuffer), { mergePages: true })
        extractedText = result.text || ''
        pageCount = result.totalPages || 1
        console.log('PDF text extracted, pages:', pageCount, 'text length:', extractedText.length)
        
        if (!extractedText || extractedText.trim().length === 0) {
          console.warn('PDF extraction returned empty text')
        }
      } else if (document.file_type === 'docx') {
        console.log('Extracting text from DOCX...', {
          bufferSize: arrayBuffer.byteLength,
          fileType: document.file_type,
        })
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer })
        extractedText = result.value || ''
        // Estimate page count (roughly 500 words per page)
        const wordCount = extractedText.split(/\s+/).filter((w: string) => w.length > 0).length
        pageCount = Math.max(1, Math.ceil(wordCount / 500))
        console.log('DOCX text extracted, estimated pages:', pageCount, 'text length:', extractedText.length)
        
        if (!extractedText || extractedText.trim().length === 0) {
          console.warn('DOCX extraction returned empty text')
        }
      } else if (document.file_type === 'epub') {
        console.log('Extracting text from EPUB...')
        // EPUB extraction - for now return placeholder, can be implemented later
        extractedText = 'EPUB text extraction is being processed...'
        pageCount = 1
        console.warn('EPUB extraction not fully implemented yet')
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

    // Detect language using the detectLanguage helper
    let detectedLanguage = 'en'
    try {
      detectedLanguage = await detectLanguage(extractedText)
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

