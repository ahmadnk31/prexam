import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_EXTRACT_AUDIO_FUNCTION || 'extract-audio'

export interface ExtractAudioParams {
  videoS3Key: string
  videoS3Bucket: string
  outputS3Key?: string
  outputS3Bucket?: string
}

export interface ExtractAudioResult {
  success: boolean
  audioS3Key: string
  audioS3Bucket: string
  audioSize: number
}

/**
 * Extract audio from a video file using AWS Lambda
 * @param params Video S3 location and optional output location
 * @returns Audio file S3 location and size
 */
export async function extractAudioFromVideo(
  params: ExtractAudioParams
): Promise<ExtractAudioResult> {
  if (!process.env.AWS_LAMBDA_EXTRACT_AUDIO_FUNCTION && !process.env.AWS_REGION) {
    throw new Error('AWS Lambda audio extraction is not configured. Set AWS_LAMBDA_EXTRACT_AUDIO_FUNCTION and AWS_REGION environment variables.')
  }

  console.log('Invoking Lambda function to extract audio:', {
    functionName: LAMBDA_FUNCTION_NAME,
    videoS3Key: params.videoS3Key,
    videoS3Bucket: params.videoS3Bucket,
  })

  try {
    const payload = {
      videoS3Key: params.videoS3Key,
      videoS3Bucket: params.videoS3Bucket,
      outputS3Key: params.outputS3Key,
      outputS3Bucket: params.outputS3Bucket,
    }
    
    console.log('Lambda invocation payload:', JSON.stringify(payload, null, 2))
    
    const invokeCommand = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify(payload),
    })

    console.log('Invoking Lambda function:', LAMBDA_FUNCTION_NAME)
    const response = await lambdaClient.send(invokeCommand)
    
    console.log('Lambda invocation response received:', {
      StatusCode: response.StatusCode,
      FunctionError: response.FunctionError,
      PayloadLength: response.Payload?.length,
    })
    
    // Check for function errors (Lambda execution errors, not application errors)
    if (response.FunctionError) {
      console.error('Lambda function execution error:', response.FunctionError)
      let errorMessage = response.FunctionError
      if (response.Payload) {
        try {
          const errorPayload = JSON.parse(Buffer.from(response.Payload).toString())
          errorMessage = errorPayload.errorMessage || errorPayload.error || errorPayload.message || response.FunctionError
        } catch (e) {
          // If we can't parse, use the raw payload
          errorMessage = Buffer.from(response.Payload).toString()
        }
      }
      throw new Error(`Lambda function execution failed: ${errorMessage}`)
    }

    if (!response.Payload) {
      throw new Error('Lambda function returned no payload')
    }

    let result: any
    try {
      const payloadString = Buffer.from(response.Payload).toString()
      console.log('Lambda raw response payload (first 1000 chars):', payloadString.substring(0, 1000))
      result = JSON.parse(payloadString)
    } catch (parseError: any) {
      console.error('Failed to parse Lambda response:', parseError)
      const rawPayload = Buffer.from(response.Payload).toString()
      throw new Error(`Lambda returned invalid JSON response: ${parseError.message}. Raw: ${rawPayload.substring(0, 200)}`)
    }
    
    console.log('Lambda parsed response:', JSON.stringify(result, null, 2))

    // Handle Lambda function response format
    if (result.statusCode === 200) {
      let body: any
      try {
        body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body
      } catch (parseError) {
        console.error('Failed to parse Lambda response body:', parseError)
        throw new Error('Lambda returned invalid response body')
      }
      
      if (!body || !body.audioS3Key || !body.audioS3Bucket) {
        throw new Error(`Lambda response missing required fields. Got: ${JSON.stringify(body)}`)
      }
      
      return {
        success: true,
        audioS3Key: body.audioS3Key,
        audioS3Bucket: body.audioS3Bucket,
        audioSize: body.audioSize || 0,
      }
    } else {
      // Handle error response - result.body might be a string or object
      let errorBody: any = null
      try {
        errorBody = typeof result.body === 'string' ? JSON.parse(result.body) : result.body
      } catch (parseError) {
        // If parsing fails, use the raw body or result
        errorBody = result.body || result
      }
      
      // Safely access error message
      const errorMessage = 
        (errorBody && (errorBody.message || errorBody.error)) || 
        result.errorMessage || 
        result.error || 
        `Lambda function failed with status ${result.statusCode}` ||
        JSON.stringify(result)
      
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    console.error('Lambda invocation error:', error)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
    
    // Provide more helpful error message
    if (error.message && !error.message.includes('Failed to extract audio')) {
      throw new Error(`Failed to extract audio: ${error.message}`)
    }
    throw error
  }
}

