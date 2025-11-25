import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Validate and clean AWS credentials
function getAwsCredentials() {
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim()
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim()
  const region = (process.env.AWS_REGION || 'us-east-1').trim()

  // Validate Access Key ID format
  if (!accessKeyId) {
    throw new Error('AWS_ACCESS_KEY_ID is not set in environment variables. Check your .env.local file.')
  }
  
  // AWS Access Key IDs should only contain alphanumeric characters
  // They typically start with letters and are 20 characters long
  if (accessKeyId.includes('/') || accessKeyId.includes('+') || accessKeyId.includes('=')) {
    console.error('ERROR: AWS_ACCESS_KEY_ID contains invalid characters!')
    console.error('Current Access Key ID (first 30 chars):', accessKeyId.substring(0, 30))
    console.error('AWS Access Key IDs should ONLY contain alphanumeric characters (A-Z, a-z, 0-9)')
    console.error('They should NOT contain: /, +, =, or any other special characters')
    throw new Error(
      'Invalid AWS_ACCESS_KEY_ID format. Access Key IDs should only contain alphanumeric characters.\n' +
      'Your key appears to contain "/" or "+" characters which are invalid.\n' +
      'Please check your .env.local file and ensure AWS_ACCESS_KEY_ID is correct.\n' +
      'Get a new Access Key from: https://console.aws.amazon.com/iam/ (Users → Security credentials)'
    )
  }

  if (accessKeyId.length < 16 || accessKeyId.length > 128) {
    throw new Error(`AWS_ACCESS_KEY_ID appears invalid (length: ${accessKeyId.length}). Expected 16-128 characters.`)
  }

  if (!secretAccessKey) {
    throw new Error('AWS_SECRET_ACCESS_KEY is not set in environment variables. Check your .env.local file.')
  }

  if (secretAccessKey.length < 20) {
    throw new Error(`AWS_SECRET_ACCESS_KEY appears invalid (length: ${secretAccessKey.length}). Secret keys are typically 40+ characters.`)
  }

  return {
    accessKeyId,
    secretAccessKey,
    region,
  }
}

// Initialize S3 client with checksum disabled to avoid issues
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
      // Disable request checksums to avoid 400 errors
      requestChecksumCalculation: 'DISABLED',
    })
  }
  return s3Client
}

// S3 bucket name (single bucket for all file types)
const S3_BUCKET = process.env.AWS_S3_BUCKET || ''

/**
 * Generate a presigned URL for uploading a file directly to S3
 * @param type - Type of file (videos, documents, thumbnails)
 * @param userId - User ID
 * @param fileName - File name
 * @param contentType - MIME type of the file
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL and the S3 key
 */
export async function generatePresignedUploadUrl(
  type: 'videos' | 'documents' | 'thumbnails',
  userId: string,
  fileName: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour
): Promise<{ url: string; key: string }> {
  if (!S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is not set.')
  }

  // Generate S3 key with type prefix: videos/userId/fileName, documents/userId/fileName, etc.
  const key = `${type}/${userId}/${fileName}`

  // Create a minimal PutObjectCommand
  // IMPORTANT: Do NOT include ACL - it causes 400 errors if bucket has ACLs disabled
  // Do NOT include checksums - they can cause 400 errors
  // Keep it simple - just bucket, key, and content type
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
    // Metadata is optional - remove if it causes issues
    // Metadata: {
    //   'uploaded-by': userId,
    //   'upload-timestamp': new Date().toISOString(),
    // },
  })

  try {
    const client = getS3Client()
    const url = await getSignedUrl(client, command, { expiresIn })
    
    // Validate the URL was generated
    if (!url || !url.startsWith('http')) {
      throw new Error('Invalid presigned URL generated')
    }
    
    return { url, key }
  } catch (error: any) {
    console.error('Error generating presigned URL:', error)
    console.error('S3 configuration:', {
      bucket,
      key,
      region: process.env.AWS_REGION,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    })
    throw new Error(`Failed to generate presigned URL: ${error.message || 'Unknown error'}`)
  }
}

