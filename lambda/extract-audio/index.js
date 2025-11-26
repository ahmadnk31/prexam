import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  const { videoS3Key, videoS3Bucket, outputS3Key, outputS3Bucket } = event;
  
  if (!videoS3Key || !videoS3Bucket) {
    console.error('Missing required parameters:', { videoS3Key, videoS3Bucket });
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'videoS3Key and videoS3Bucket are required',
        message: 'videoS3Key and videoS3Bucket are required'
      }),
    };
  }
  
  const outputBucket = outputS3Bucket || videoS3Bucket;
  const outputKey = outputS3Key || videoS3Key.replace(/\.(mp4|webm|mov|avi|mkv)$/i, '.mp3');
  
  const tempDir = os.tmpdir();
  const videoPath = path.join(tempDir, `input-${Date.now()}.${path.extname(videoS3Key)}`);
  const audioPath = path.join(tempDir, `output-${Date.now()}.mp3`);
  
  try {
    // Download video from S3
    console.log(`Downloading video from s3://${videoS3Bucket}/${videoS3Key}`);
    const getObjectResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: videoS3Bucket,
        Key: videoS3Key,
      })
    );
    
    const videoStream = getObjectResponse.Body;
    const chunks = [];
    for await (const chunk of videoStream) {
      chunks.push(chunk);
    }
    const videoBuffer = Buffer.concat(chunks);
    
    // Write video to temp file
    fs.writeFileSync(videoPath, videoBuffer);
    console.log(`Video downloaded, size: ${videoBuffer.length} bytes`);
    
    // Extract audio using ffmpeg
    // Check if ffmpeg is available in PATH or /opt/bin (Lambda layer location)
    let ffmpegPath = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
    
    // Try to find ffmpeg if not set
    if (!ffmpegPath || ffmpegPath === '/opt/bin/ffmpeg') {
      try {
        const whichResult = await execAsync('which ffmpeg');
        if (whichResult && whichResult.stdout) {
          ffmpegPath = whichResult.stdout.trim();
        }
      } catch (e) {
        // which command failed, try default paths
        ffmpegPath = '/opt/bin/ffmpeg';
      }
    }
    
    // Fallback to just 'ffmpeg' if path doesn't exist
    if (ffmpegPath === '/opt/bin/ffmpeg' && !fs.existsSync(ffmpegPath)) {
      ffmpegPath = 'ffmpeg';
    }
    
    console.log('Extracting audio using ffmpeg at:', ffmpegPath);
    const ffmpegCommand = `"${ffmpegPath}" -i "${videoPath}" -vn -acodec libmp3lame -ab 128k -ar 44100 -ac 2 "${audioPath}" -y`;
    
    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      console.log('FFmpeg stdout:', stdout);
      if (stderr) {
        console.log('FFmpeg stderr:', stderr);
      }
    } catch (ffmpegError) {
      console.error('FFmpeg error:', ffmpegError);
      const errorMsg = ffmpegError.message || ffmpegError.stderr || 'Unknown FFmpeg error';
      throw new Error(`FFmpeg failed: ${errorMsg}`);
    }
    
    // Check if audio file was created
    if (!fs.existsSync(audioPath)) {
      throw new Error('Audio file was not created by ffmpeg');
    }
    
    const audioStats = fs.statSync(audioPath);
    console.log(`Audio extracted, size: ${audioStats.size} bytes`);
    
    // Upload audio to S3
    console.log(`Uploading audio to s3://${outputBucket}/${outputKey}`);
    const audioBuffer = fs.readFileSync(audioPath);
    
    await s3Client.send(
      new PutObjectCommand({
        Bucket: outputBucket,
        Key: outputKey,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
      })
    );
    
    console.log('Audio uploaded successfully');
    
    // Cleanup temp files
    try {
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);
    } catch (cleanupError) {
      console.warn('Cleanup error (non-critical):', cleanupError);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        audioS3Key: outputKey,
        audioS3Bucket: outputBucket,
        audioSize: audioStats.size,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    
    // Cleanup temp files on error
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    } catch (cleanupError) {
      console.warn('Cleanup error (non-critical):', cleanupError);
    }
    
    const errorResponse = {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to extract audio',
        message: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
    };
    
    console.error('Lambda error response:', JSON.stringify(errorResponse, null, 2));
    return errorResponse;
  }
};

