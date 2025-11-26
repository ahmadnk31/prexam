import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Validate and clean AWS credentials
function getAwsCredentials() {
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim()
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim()
  const region = (process.env.AWS_REGION || 'us-east-1').trim()

  if (!accessKeyId) {
    throw new Error('AWS_ACCESS_KEY_ID is not set in environment variables')
  }
  
  if (!secretAccessKey) {
    throw new Error('AWS_SECRET_ACCESS_KEY is not set in environment variables')
  }

  // Check for common issues with Access Key ID
  if (accessKeyId.includes('/') || accessKeyId.includes('+')) {
    console.error('ERROR: AWS_ACCESS_KEY_ID contains invalid characters (/ or +)')
    console.error('Access Key ID:', accessKeyId.substring(0, 20) + '...')
    console.error('AWS Access Key IDs should only contain alphanumeric characters.')
    console.error('Please check your .env.local file and ensure the key is correct.')
    throw new Error('Invalid AWS_ACCESS_KEY_ID format. Access Key IDs should not contain "/" or "+" characters.')
  }

  return {
    accessKeyId,
    secretAccessKey,
    region,
  }
}

// Initialize S3 client
let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    const credentials = getAwsCredentials()
    s3Client = new S3Client({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    })
  }
  return s3Client
}

// S3 bucket name (single bucket for all file types)
const S3_BUCKET = process.env.AWS_S3_BUCKET || ''

// CloudFront domain
const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN || ''

/**
 * Get the S3 key (path) for a file
 * Files are organized by type prefix: videos/userId/fileName, documents/userId/fileName, thumbnails/userId/fileName
 */
function getS3Key(type: 'videos' | 'documents' | 'thumbnails', userId: string, fileName: string): string {
  return `${type}/${userId}/${fileName}`
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
  type: 'videos' | 'documents' | 'thumbnails',
  userId: string,
  fileName: string,
  file: Buffer | Uint8Array | Blob | File,
  contentType?: string
): Promise<string> {
  if (!S3_BUCKET) {
    console.error('S3_BUCKET is empty. Check AWS_S3_BUCKET environment variable.')
    throw new Error('AWS_S3_BUCKET environment variable is not set.')
  }

  const key = getS3Key(type, userId, fileName)
  console.log('Preparing S3 upload:', {
    bucket: S3_BUCKET,
    key,
    type,
    fileName,
    userId,
    hasFile: !!file,
    fileSize: file instanceof File || file instanceof Blob ? 'unknown' : file.length,
  })
  
  // Convert File/Blob to Buffer if needed
  let body: Buffer | Uint8Array
  if (file instanceof File || file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer()
    body = Buffer.from(arrayBuffer)
    console.log('Converted file to buffer, size:', body.length, 'bytes')
  } else {
    body = file
  }

  // Detect content type if not provided
  let detectedContentType = contentType
  if (!detectedContentType && file instanceof File) {
    detectedContentType = file.type
  }

  const client = getS3Client()
  console.log('S3 client created, region:', process.env.AWS_REGION || 'us-east-1')

  // Try with ACL first (for buckets with ACLs enabled)
  let command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: detectedContentType || 'application/octet-stream',
    ACL: 'public-read',
  })

  try {
    console.log('Attempting S3 upload with ACL...')
    await client.send(command)
    console.log('File uploaded to S3 successfully:', key)
    return key
  } catch (error: any) {
    console.error('S3 upload error (with ACL):', {
      name: error.name,
      message: error.message,
      code: error.Code,
      statusCode: error.$metadata?.httpStatusCode,
    })
    
    // If ACL fails (bucket has ACLs disabled), try without ACL
    // Bucket policy should handle public access
    if (error.name === 'NotImplemented' || 
        error.message?.includes('ACL') || 
        error.message?.includes('AccessControlListNotSupported') ||
        error.Code === 'AccessControlListNotSupported') {
      console.log('ACL not supported, retrying without ACL')
      command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: detectedContentType || 'application/octet-stream',
        // No ACL - rely on bucket policy for public access
      })
      
      try {
        console.log('Attempting S3 upload without ACL...')
        await client.send(command)
        console.log('File uploaded to S3 successfully (without ACL):', key)
        return key
      } catch (retryError: any) {
        console.error('S3 upload error (retry without ACL):', {
          name: retryError.name,
          message: retryError.message,
          code: retryError.Code,
          statusCode: retryError.$metadata?.httpStatusCode,
          stack: retryError.stack,
        })
        throw new Error(`Failed to upload to S3: ${retryError.message || 'Unknown error'}`)
      }
    } else {
      console.error('S3 upload error (non-ACL):', {
        name: error.name,
        message: error.message,
        code: error.Code,
        statusCode: error.$metadata?.httpStatusCode,
        stack: error.stack,
      })
      throw new Error(`Failed to upload to S3: ${error.message || 'Unknown error'}`)
    }
  }
}

/**
 * Download a file from S3
 */
export async function downloadFromS3(
  type: 'videos' | 'documents' | 'thumbnails',
  s3Key: string
): Promise<Buffer> {
  if (!S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set.')
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  })

  try {
    const client = getS3Client()
    const response = await client.send(command)
    
    if (!response.Body) {
      throw new Error('No data returned from S3')
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    const reader = response.Body.transformToWebStream().getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))
  } catch (error: any) {
    console.error('S3 download error:', error)
    if (error.name === 'NoSuchKey') {
      throw new Error(`File not found in S3: ${s3Key}`)
    }
    throw new Error(`Failed to download from S3: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(
  type: 'videos' | 'documents' | 'thumbnails',
  s3Key: string
): Promise<void> {
  if (!S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set.')
  }

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  })

  try {
    const client = getS3Client()
    await client.send(command)
  } catch (error: any) {
    console.error('S3 delete error:', error)
    throw new Error(`Failed to delete from S3: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Check if a file exists in S3
 */
export async function fileExistsInS3(
  type: 'videos' | 'documents' | 'thumbnails',
  s3Key: string
): Promise<boolean> {
  if (!S3_BUCKET) {
    return false
  }

  const command = new HeadObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  })

  try {
    const client = getS3Client()
    await client.send(command)
    return true
  } catch (error: any) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      return false
    }
    throw error
  }
}

/**
 * Get public URL for a file (CloudFront or S3)
 */
export function getPublicUrl(
  type: 'videos' | 'documents' | 'thumbnails',
  s3Key: string
): string {
  // If CloudFront is configured, use it (faster and cheaper)
  if (CLOUDFRONT_DOMAIN) {
    // Remove trailing slash if present and ensure it doesn't have protocol
    let domain = CLOUDFRONT_DOMAIN.replace(/\/$/, '').trim()
    
    // Add https:// if not present
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`
    }
    
    // Always use s3Key as-is (it already includes type prefix: videos/, documents/, thumbnails/)
    return `${domain}/${s3Key}`
  }

  // Fallback to S3 public URL
  if (!S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set.')
  }
  
  const region = process.env.AWS_REGION || 'us-east-1'
  return `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${s3Key}`
}

/**
 * Get a signed URL for private files (expires in 1 hour by default)
 */
export async function getSignedUrlForS3(
  type: 'videos' | 'documents' | 'thumbnails',
  s3Key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  if (!S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set.')
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  })

  try {
    const client = getS3Client()
    const signedUrl = await getSignedUrl(client, command, { expiresIn })
    return signedUrl
  } catch (error: any) {
    console.error('Error generating signed URL:', error)
    throw new Error(`Failed to generate signed URL: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Extract S3 key from a URL (CloudFront or S3)
 */
export function extractS3KeyFromUrl(url: string): string | null {
  // CloudFront URL pattern: https://d1234567890.cloudfront.net/videos/userId/fileName
  if (CLOUDFRONT_DOMAIN && url.includes(CLOUDFRONT_DOMAIN)) {
    const domain = CLOUDFRONT_DOMAIN.replace(/\/$/, '')
    const domainWithProtocol = domain.startsWith('http') ? domain : `https://${domain}`
    const urlPath = url.replace(domainWithProtocol, '').replace(/^\//, '')
    // Key should include type prefix (videos/, documents/, thumbnails/)
    return urlPath
  }
  
  // S3 URL pattern: https://bucket-name.s3.region.amazonaws.com/videos/userId/fileName
  const s3Pattern = /https?:\/\/([^\/]+)\.s3[^\/]*\.amazonaws\.com\/(.+)$/
  const match = url.match(s3Pattern)
  
  if (match) {
    // Key should include type prefix (videos/, documents/, thumbnails/)
    return match[2]
  }
  
  return null
}

