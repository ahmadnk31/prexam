#!/bin/bash

# Deploy script for extract-audio Lambda function
# Make sure you have AWS CLI configured and appropriate permissions

set -e

echo "🚀 Deploying extract-audio Lambda function..."

# Configuration
FUNCTION_NAME="${AWS_LAMBDA_EXTRACT_AUDIO_FUNCTION:-extract-audio}"
REGION="${AWS_REGION:-us-east-1}"
ROLE_NAME="${AWS_LAMBDA_ROLE_NAME:-lambda-extract-audio-role}"
FFMPEG_LAYER_ARN="${AWS_FFMPEG_LAYER_ARN}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ Failed to get AWS account ID. Check your AWS credentials."
    exit 1
fi

echo "📦 Creating deployment package..."
cd "$(dirname "$0")"
npm install --production
zip -r function.zip . -x '*.git*' '*.zip' 'node_modules/.cache/*' '*.md' 'deploy.sh'

# Check if function exists
FUNCTION_EXISTS=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>&1 || echo "NOT_FOUND")

if [[ "$FUNCTION_EXISTS" == *"NOT_FOUND"* ]] || [[ "$FUNCTION_EXISTS" == *"ResourceNotFoundException"* ]]; then
    echo "📝 Creating new Lambda function..."
    
    # Get role ARN
    ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>&1 || echo "NOT_FOUND")
    
    if [[ "$ROLE_ARN" == *"NOT_FOUND"* ]]; then
        echo "❌ IAM role '$ROLE_NAME' not found. Please create it first (see AWS_LAMBDA_SETUP.md)"
        exit 1
    fi
    
    # Build create command
    CREATE_CMD="aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs20.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://function.zip \
        --timeout 900 \
        --memory-size 3008 \
        --environment Variables=\"{AWS_REGION=$REGION}\" \
        --region $REGION"
    
    # Add layer if provided
    if [ -n "$FFMPEG_LAYER_ARN" ]; then
        CREATE_CMD="$CREATE_CMD --layers $FFMPEG_LAYER_ARN"
        echo "📎 Using FFmpeg layer: $FFMPEG_LAYER_ARN"
    else
        echo "⚠️  No FFmpeg layer specified. Set AWS_FFMPEG_LAYER_ARN environment variable."
        echo "   The function will work but FFmpeg must be available in the Lambda environment."
    fi
    
    eval $CREATE_CMD
    
    echo "✅ Lambda function created successfully!"
else
    echo "🔄 Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://function.zip \
        --region "$REGION"
    
    # Update configuration (timeout, memory, layers, environment)
    echo "⚙️  Updating function configuration..."
    UPDATE_CONFIG_CMD="aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout 900 \
        --memory-size 3008 \
        --environment Variables=\"{AWS_REGION=$REGION}\" \
        --region $REGION"
    
    # Add layer if provided
    if [ -n "$FFMPEG_LAYER_ARN" ]; then
        UPDATE_CONFIG_CMD="$UPDATE_CONFIG_CMD --layers $FFMPEG_LAYER_ARN"
        echo "📎 Using FFmpeg layer: $FFMPEG_LAYER_ARN"
    fi
    
    eval $UPDATE_CONFIG_CMD
    
    echo "✅ Lambda function updated successfully!"
fi

# Clean up
rm -f function.zip

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Function name: $FUNCTION_NAME"
echo "Region: $REGION"
echo ""
echo "To test the function:"
echo "  aws lambda invoke \\"
echo "    --function-name $FUNCTION_NAME \\"
echo "    --payload '{\"videoS3Key\":\"videos/test/video.mp4\",\"videoS3Bucket\":\"your-bucket\"}' \\"
echo "    --region $REGION \\"
echo "    response.json"
echo ""
echo "Don't forget to set these environment variables in your .env.local:"
echo "  AWS_LAMBDA_EXTRACT_AUDIO_FUNCTION=$FUNCTION_NAME"
echo "  AWS_REGION=$REGION"

