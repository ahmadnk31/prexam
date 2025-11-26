# Extract Audio Lambda Function

This AWS Lambda function extracts audio from video files stored in S3.

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. FFmpeg layer for Lambda (or include FFmpeg in the deployment package)
3. IAM role with permissions to read from source S3 bucket and write to destination S3 bucket

## Deployment

### Option 1: Using FFmpeg Layer (Recommended)

1. Use a pre-built FFmpeg layer from [this repository](https://github.com/serverlesspub/ffmpeg-aws-lambda-layer) or create your own.

2. Create the Lambda function:
```bash
cd lambda/extract-audio
npm install
zip -r function.zip . -x '*.git*' '*.zip' 'node_modules/.cache/*'
```

3. Create Lambda function:
```bash
aws lambda create-function \
  --function-name extract-audio \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 900 \
  --memory-size 3008 \
  --layers arn:aws:lambda:REGION:YOUR_ACCOUNT_ID:layer:ffmpeg:VERSION
```

### Option 2: Using Docker Image

Create a Dockerfile that includes FFmpeg:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

RUN yum install -y ffmpeg

COPY package.json ${LAMBDA_TASK_ROOT}
RUN npm install

COPY index.js ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
```

Build and deploy:
```bash
docker build -t extract-audio-lambda .
aws ecr create-repository --repository-name extract-audio-lambda
# ... push to ECR and create Lambda function from image
```

## IAM Permissions

The Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_VIDEO_BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_AUDIO_BUCKET/*"
    }
  ]
}
```

## Environment Variables

- `AWS_REGION`: AWS region (default: us-east-1)

## Usage

Invoke the function with:

```json
{
  "videoS3Key": "videos/user-id/video-id.mp4",
  "videoS3Bucket": "your-video-bucket",
  "outputS3Key": "audio/user-id/video-id.mp3",
  "outputS3Bucket": "your-audio-bucket"
}
```

## Response

Success:
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "audioS3Key": "audio/user-id/video-id.mp3",
    "audioS3Bucket": "your-audio-bucket",
    "audioSize": 1234567
  }
}
```

Error:
```json
{
  "statusCode": 500,
  "body": {
    "error": "Failed to extract audio",
    "message": "Error details"
  }
}
```

