import { createServiceClient } from '@/supabase/service'
import mammoth from 'mammoth'
import { Readable } from 'stream'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Helper to convert buffer to stream
function bufferToStream(buffer: Buffer) {
  return Readable.from(buffer)
}

async function extractPDFText(fileBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // Use LangChain PDFLoader for reliable PDF text extraction
  // Create a temporary file since PDFLoader works best with file paths
  const tempFilePath = join(tmpdir(), `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`)
  
  try {
    // Write buffer to temporary file
    writeFileSync(tempFilePath, fileBuffer)
    
    // Create PDFLoader with the file path
    const loader = new PDFLoader(tempFilePath, {
      splitPages: false, // Get all pages as one document
    })
    
    // Load the document
    const docs = await loader.load()
    
    // Combine all pages into one text
    const text = docs.map(doc => doc.pageContent).join('\n\n')
    
    // Get page count from metadata if available, otherwise estimate
    const pageCount = docs.length > 0 && docs[0].metadata?.pdf?.totalPages 
      ? docs[0].metadata.pdf.totalPages 
      : docs.length || 1
    
    return {
      text,
      pageCount,
    }
  } finally {
    // Clean up temporary file
    try {
      unlinkSync(tempFilePath)
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Failed to delete temporary PDF file:', tempFilePath)
    }
  }
}

async function extractWordText(fileBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const result = await mammoth.extractRawText({ buffer: fileBuffer })
  // Estimate page count (roughly 500 words per page)
  const wordCount = result.value.split(/\s+/).length
  const estimatedPages = Math.ceil(wordCount / 500)
  return {
    text: result.value,
    pageCount: estimatedPages,
  }
}

async function extractEPUBText(fileBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // For EPUB, we'll use epub2 library
  const epub = require('epub2')
  return new Promise((resolve, reject) => {
    try {
      const book = new epub(bufferToStream(fileBuffer))
      let fullText = ''

      book.on('end', () => {
        // Estimate pages (roughly 500 words per page)
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

      book.on('chapter', (chapter: any) => {
        // Extract text from HTML (simple approach)
        const text = chapter.body
          ? chapter.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          : ''
        if (text) {
          fullText += text + '\n\n'
        }
      })

      book.parse()
    } catch (error) {
      reject(error)
    }
  })
}

export async function processDocument(documentId: string) {
  try {
    const serviceClient = createServiceClient()

    // Get document
    const { data: document, error: docError } = await serviceClient
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

    // Download file
    const fileResponse = await fetch(document.file_url)
    if (!fileResponse.ok) {
      throw new Error('Failed to download document file')
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer())

    // Extract text based on file type
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
      await serviceClient
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)
      
      throw new Error(`Failed to extract text from document: ${extractError.message}`)
    }

    if (!extractedText || extractedText.trim().length === 0) {
      await serviceClient
        .from('documents')
        .update({ status: 'error' })
        .eq('id', documentId)
      
      throw new Error('No text could be extracted from the document')
    }

    // Split text into chunks (for large documents)
    const chunkSize = 5000 // characters per chunk
    const chunks: string[] = []
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      chunks.push(extractedText.slice(i, i + chunkSize))
    }

    // Store chunks
    if (chunks.length > 0) {
      const chunkInserts = chunks.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: chunk,
        page_number: document.file_type === 'pdf' ? Math.floor((index / chunks.length) * pageCount) + 1 : null,
      }))

      // Delete existing chunks
      await serviceClient
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId)

      // Insert new chunks
      const { error: chunksError } = await serviceClient
        .from('document_chunks')
        .insert(chunkInserts)

      if (chunksError) {
        console.error('Error inserting chunks:', chunksError)
      }
    }

    // Update document with extracted text and status
    await serviceClient
      .from('documents')
      .update({
        extracted_text: extractedText,
        page_count: pageCount,
        status: 'ready',
      })
      .eq('id', documentId)

    return {
      success: true,
      documentId,
      textLength: extractedText.length,
      chunksCount: chunks.length,
      pageCount,
    }
  } catch (error: any) {
    console.error('Document processing error:', error)
    throw error
  }
}

