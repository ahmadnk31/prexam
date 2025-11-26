# AWS Lambda Audio Extraction Setup

This guide explains how to set up AWS Lambda functions to extract audio from video files, offloading the processing from your Next.js server.

## Benefits

- **Scalability**: Lambda can handle multiple concurrent extractions
- **Cost Efficiency**: Pay only for what you use
- **Performance**: Faster processing for large files
- **Resource Management**: Frees up server resources

## Prerequisites

1. AWS CLI installed and configured
2. AWS account with appropriate permissions
3. S3 bucket for storing videos and audio files
4. IAM role for Lambda execution

## Step 1: Create FFmpeg Layer for Lambda

FFmpeg is required for audio extraction. You have two options:

### Option A: Use Pre-built Layer (Easiest)

Use a community-maintained FFmpeg layer:

```bash
# Find a layer ARN for your region from:
# https://github.com/serverlesspub/ffmpeg-aws-lambda-layer

# Example for us-east-1:
LAYER_ARN="arn:aws:lambda:us-east-1:764866452798:layer:ffmpeg:1"
```

### Option B: Create Your Own Layer

1. Create a layer with FFmpeg:
```bash
# Download FFmpeg static build
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar -xf ffmpeg-release-amd64-static.tar.xz
mkdir -p layer/bin
cp ffmpeg-*-amd64-static/ffmpeg layer/bin/
chmod +x layer/bin/ffmpeg

# Create layer zip
cd layer
zip -r ../ffmpeg-layer.zip .
cd ..

# Create Lambda layer
aws lambda publish-layer-version \
  --layer-name ffmpeg \
  --zip-file fileb://ffmpeg-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region us-east-1
```

## Step 2: Create IAM Role for Lambda

```bash
# Create trust policy
cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name lambda-extract-audio-role \
  --assume-role-policy-document file://trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name lambda-extract-audio-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach S3 access policy
cat > s3-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name lambda-extract-audio-role \
  --policy-name S3Access \
  --policy-document file://s3-policy.json

# Get role ARN
aws iam get-role --role-name lambda-extract-audio-role --query 'Role.Arn' --output text
```

## Step 3: Deploy Lambda Function

```bash
cd lambda/extract-audio

# Install dependencies
npm install

# Create deployment package
zip -r function.zip . -x '*.git*' '*.zip' 'node_modules/.cache/*'

# Create Lambda function
# IMPORTANT: Make sure the runtime supports CommonJS (nodejs20.x does)
aws lambda create-function \
  --function-name extract-audio \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-extract-audio-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 900 \
  --memory-size 3008 \
  --environment Variables="{AWS_REGION=us-east-1}" \
  --layers arn:aws:lambda:REGION:YOUR_ACCOUNT_ID:layer:ffmpeg:VERSION \
  --package-type Zip

# Or update existing function
aws lambda update-function-code \
  --function-name extract-audio \
  --zip-file fileb://function.zip
```

## Step 4: Configure Environment Variables

Add to your `.env.local`:

```env
AWS_LAMBDA_EXTRACT_AUDIO_FUNCTION=extract-audio
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

## Step 5: Test the Lambda Function

```bash
aws lambda invoke \
  --function-name extract-audio \
  --payload '{
    "videoS3Key": "videos/user-id/video-id.mp4",
    "videoS3Bucket": "your-bucket-name",
    "outputS3Key": "audio/user-id/video-id.mp3",
    "outputS3Bucket": "your-bucket-name"
  }' \
  response.json

cat response.json
```

## Step 6: Update Your Application

The code in `lib/transcribe.ts` has been updated to automatically use Lambda if configured. No additional changes needed!

## Troubleshooting

### Lambda Timeout

If videos are large, increase timeout:
```bash
aws lambda update-function-configuration \
  --function-name extract-audio \
  --timeout 900
```

### Memory Issues

Increase memory allocation:
```bash
aws lambda update-function-configuration \
  --function-name extract-audio \
  --memory-size 3008
```

### FFmpeg Not Found

Ensure the FFmpeg layer is attached and the path is correct in the Lambda function.

### S3 Access Denied

Check IAM role permissions and bucket policies.

## Cost Considerations

- Lambda charges per 100ms of execution time
- Memory allocation affects cost
- S3 storage and transfer costs apply
- Consider using S3 lifecycle policies to delete temporary files

## Monitoring

Set up CloudWatch alarms for:
- Lambda errors
- Execution duration
- Memory usage
- S3 access patterns

