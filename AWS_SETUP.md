# AWS S3 + CloudFront Setup Guide

This guide will help you set up AWS S3 and CloudFront for storing videos, documents, and thumbnails in your Summaryr application.

## Why AWS S3 + CloudFront?

- **Cost-effective**: Much cheaper than Supabase Storage for large files
- **Scalable**: Handles unlimited storage and bandwidth
- **Fast**: CloudFront CDN provides global content delivery
- **Reliable**: 99.999999999% (11 9's) durability

## Prerequisites

1. An AWS account ([sign up here](https://aws.amazon.com/))
2. AWS CLI installed (optional, but helpful)
3. Basic understanding of AWS services

## Step 1: Create S3 Buckets

### 1.1 Navigate to S3 Console

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Search for "S3" and click on it
3. Click **"Create bucket"**

### 1.2 Create Videos Bucket

1. **Bucket name**: `summaryr-videos` (or your preferred name, must be globally unique)
2. **AWS Region**: Choose a region close to your users (e.g., `us-east-1`, `eu-west-1`)
3. **Object Ownership**: Select **"ACLs enabled"** (for public access)
4. **Block Public Access settings**: 
   - **Uncheck** "Block all public access" (we need public read access)
   - Acknowledge the warning
5. **Bucket Versioning**: Disable (unless you need it)
6. **Default encryption**: Enable (SSE-S3 is fine)
7. Click **"Create bucket"**

### 1.3 Create Documents Bucket

Repeat the process for documents:
- **Bucket name**: `summaryr-documents`
- Same settings as videos bucket

### 1.4 Create Thumbnails Bucket (Optional)

Repeat the process for thumbnails:
- **Bucket name**: `summaryr-thumbnails`
- Same settings as videos bucket

## Step 2: Configure Bucket Policies

### 2.1 Videos Bucket Policy

1. Click on your `summaryr-videos` bucket
2. Go to **"Permissions"** tab
3. Scroll to **"Bucket policy"**
4. Click **"Edit"** and paste this policy (replace `YOUR_BUCKET_NAME` and `YOUR_ACCOUNT_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::summaryr-videos/*"
    },
    {
      "Sid": "AllowPublicUpload",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::summaryr-videos/*"
    },
    {
      "Sid": "AllowDelete",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER"
      },
      "Action": [
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::summaryr-videos/*"
    }
  ]
}
```

**Important Notes:**
- The `AllowPublicUpload` policy allows anyone to upload using presigned URLs (which are secure)
- For production, you can restrict `PutObject` to specific IAM users/roles
- Replace `YOUR_ACCOUNT_ID` with your AWS account ID (found in IAM console)
- Replace `YOUR_IAM_USER` with your IAM user name (or remove this statement if not needed)

### 2.2 Repeat for Documents and Thumbnails

Apply similar policies to your documents and thumbnails buckets.

## Step 3: Set Up CloudFront Distribution

### 3.1 Create Distribution

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click **"Create distribution"**
3. Configure:
   - **Origin domain**: Select your S3 bucket (e.g., `summaryr-videos.s3.us-east-1.amazonaws.com`)
   - **Origin access**: Select **"Public"** (or use OAC for better security)
   - **Name**: `summaryr-videos-cdn`
   - **Viewer protocol policy**: **"Redirect HTTP to HTTPS"**
   - **Allowed HTTP methods**: **"GET, HEAD, OPTIONS"** (or add PUT/DELETE if needed)
   - **Cache policy**: **"CachingOptimized"** (or create custom)
   - **Price class**: Choose based on your needs (All edge locations is most expensive)
4. Click **"Create distribution"**
5. Wait 5-15 minutes for deployment

### 3.2 Choose Your Setup: One Distribution or Three?

You have three options:

#### Option A: One CloudFront Distribution with One Bucket (Simplest - Recommended)

**Use a single S3 bucket with folder prefixes:**
1. Create **one S3 bucket** (e.g., `summaryr-files`)
2. Create **one CloudFront distribution** pointing to that bucket
3. Files will be organized as:
   - `videos/userId/fileName`
   - `documents/userId/fileName`
   - `thumbnails/userId/fileName`

**Environment variables:**
```env
AWS_S3_SINGLE_BUCKET=true
AWS_S3_BUCKET=summaryr-files
# Or set all three to the same bucket name:
AWS_S3_VIDEOS_BUCKET=summaryr-files
AWS_S3_DOCUMENTS_BUCKET=summaryr-files
AWS_S3_THUMBNAILS_BUCKET=summaryr-files
```

#### Option B: One CloudFront Distribution with Three Buckets (Path-Based Routing)

**Use three separate S3 buckets with one CloudFront distribution:**
1. Create **three S3 buckets** (videos, documents, thumbnails)
2. Create **one CloudFront distribution** with multiple origins
3. Configure behaviors to route paths to different buckets

**Setup Steps:**
1. Create all three S3 buckets first
2. In CloudFront, create a distribution with the videos bucket as the default origin
3. Add two additional origins (documents and thumbnails buckets)
4. Create behaviors to route:
   - `/documents/*` → documents bucket
   - `/thumbnails/*` → thumbnails bucket
   - `/*` (default) → videos bucket

**See detailed instructions below in "3.3 One CloudFront with Multiple Origins"**

**Environment variables:**
```env
AWS_S3_VIDEOS_BUCKET=summaryr-videos
AWS_S3_DOCUMENTS_BUCKET=summaryr-documents
AWS_S3_THUMBNAILS_BUCKET=summaryr-thumbnails
AWS_CLOUDFRONT_DOMAIN=https://d1234567890.cloudfront.net
```

#### Option C: Three Separate CloudFront Distributions

**Use three separate S3 buckets and three CloudFront distributions:**
1. Create **three S3 buckets** (videos, documents, thumbnails)
2. Create **three CloudFront distributions** (one per bucket)

**Environment variables:**
```env
AWS_S3_VIDEOS_BUCKET=summaryr-videos
AWS_S3_DOCUMENTS_BUCKET=summaryr-documents
AWS_S3_THUMBNAILS_BUCKET=summaryr-thumbnails
AWS_CLOUDFRONT_DOMAIN=https://d1234567890.cloudfront.net
```

**Note**: This option is more expensive and complex to manage.

### 3.3 One CloudFront Distribution with Multiple Origins (Option B)

If you want to use **three separate S3 buckets** but **one CloudFront distribution**, follow these steps:

#### Step 1: Create All Three S3 Buckets

1. Create `summaryr-videos` bucket
2. Create `summaryr-documents` bucket  
3. Create `summaryr-thumbnails` bucket

#### Step 2: Create CloudFront Distribution with Multiple Origins

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click **"Create distribution"**
3. **Origin settings**:
   - **Origin domain**: Select `summaryr-videos.s3.us-east-1.amazonaws.com` (your videos bucket)
   - **Origin name**: `videos-origin`
   - **Origin access**: Select **"Public"**
   - Click **"Add origin"** to add more origins:
     - **Origin domain**: `summaryr-documents.s3.us-east-1.amazonaws.com`
     - **Origin name**: `documents-origin`
     - **Origin access**: **"Public"**
     - Click **"Add origin"** again:
       - **Origin domain**: `summaryr-thumbnails.s3.us-east-1.amazonaws.com`
       - **Origin name**: `thumbnails-origin`
       - **Origin access**: **"Public"**

4. **Default cache behavior** (for videos):
   - **Origin**: `videos-origin`
   - **Viewer protocol policy**: **"Redirect HTTP to HTTPS"**
   - **Allowed HTTP methods**: **"GET, HEAD, OPTIONS"**
   - **Cache policy**: **"CachingOptimized"**

5. **Additional behaviors** (click **"Create behavior"**):
   
   **Behavior 1: Documents**
   - **Path pattern**: `/documents/*`
   - **Origin**: `documents-origin`
   - **Viewer protocol policy**: **"Redirect HTTP to HTTPS"**
   - **Allowed HTTP methods**: **"GET, HEAD, OPTIONS"**
   - **Cache policy**: **"CachingOptimized"**
   - **Priority**: `1` (higher priority than default)
   
   **Behavior 2: Thumbnails**
   - **Path pattern**: `/thumbnails/*`
   - **Origin**: `thumbnails-origin`
   - **Viewer protocol policy**: **"Redirect HTTP to HTTPS"**
   - **Allowed HTTP methods**: **"GET, HEAD, OPTIONS"**
   - **Cache policy**: **"CachingOptimized"**
   - **Priority**: `2` (higher priority than default)

6. **General settings**:
   - **Name**: `summaryr-cdn`
   - **Price class**: Choose based on your needs
   - Click **"Create distribution"**

7. Wait 5-15 minutes for deployment

#### Step 3: Update Your Code to Use Path Prefixes

**Important**: When using this setup, your S3 keys need to include the type prefix. Update your `.env.local`:

```env
# Use path-based routing
AWS_S3_USE_PATH_PREFIX=true
AWS_S3_VIDEOS_BUCKET=summaryr-videos
AWS_S3_DOCUMENTS_BUCKET=summaryr-documents
AWS_S3_THUMBNAILS_BUCKET=summaryr-thumbnails
AWS_CLOUDFRONT_DOMAIN=https://d1234567890.cloudfront.net
```

**Note**: The code will automatically add `/documents/` and `/thumbnails/` prefixes to the S3 keys when uploading, so CloudFront can route them correctly.

#### How It Works

- Files uploaded to videos bucket: Stored as `userId/fileName` → CloudFront serves at `https://d1234567890.cloudfront.net/userId/fileName`
- Files uploaded to documents bucket: Stored as `userId/fileName` → CloudFront serves at `https://d1234567890.cloudfront.net/documents/userId/fileName`
- Files uploaded to thumbnails bucket: Stored as `userId/fileName` → CloudFront serves at `https://d1234567890.cloudfront.net/thumbnails/userId/fileName`

### 3.4 Get CloudFront Domain

After creation, copy the **Domain name** (e.g., `d1234567890.cloudfront.net`). You'll need this for your environment variables.

## Step 4: Create IAM User (Recommended for Production)

### 4.1 Create User

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click **"Users"** → **"Create user"**
3. **User name**: `summaryr-app`
4. **Access type**: **"Programmatic access"**
5. Click **"Next"**

### 4.2 Attach Policy

1. Click **"Attach policies directly"**
2. Search for and select: **"AmazonS3FullAccess"** (or create a custom policy with only needed permissions)
3. Click **"Next"** → **"Create user"**

### 4.3 Save Credentials

**IMPORTANT**: Copy the **Access Key ID** and **Secret Access Key**. You won't be able to see the secret key again!

## Step 5: Configure Environment Variables

Add these to your `.env.local` file:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# S3 Buckets - Choose ONE option:

# Option A: Single bucket (recommended - simpler)
AWS_S3_SINGLE_BUCKET=true
AWS_S3_BUCKET=summaryr-files
# Or set all three to the same name:
# AWS_S3_VIDEOS_BUCKET=summaryr-files
# AWS_S3_DOCUMENTS_BUCKET=summaryr-files
# AWS_S3_THUMBNAILS_BUCKET=summaryr-files

# Option B: Separate buckets
# AWS_S3_VIDEOS_BUCKET=summaryr-videos
# AWS_S3_DOCUMENTS_BUCKET=summaryr-documents
# AWS_S3_THUMBNAILS_BUCKET=summaryr-thumbnails

# CloudFront (optional but recommended)
AWS_CLOUDFRONT_DOMAIN=https://d1234567890.cloudfront.net
```

## Step 6: Test the Setup

1. Restart your Next.js development server
2. Try uploading a video or document
3. Check your S3 bucket to see if files appear
4. Verify files are accessible via CloudFront URL

## Step 7: CORS Configuration (REQUIRED for Presigned URL Uploads)

**⚠️ IMPORTANT**: CORS must be configured for presigned URL uploads to work!

If you encounter CORS errors or 400 Bad Request errors when uploading:

1. Go to your S3 bucket → **"Permissions"** tab
2. Scroll to **"Cross-origin resource sharing (CORS)"**
3. Click **"Edit"** and paste this configuration:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedOrigins": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-server-side-encryption",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

**For Production**: Replace `"*"` in `AllowedOrigins` with your specific domain:
```json
"AllowedOrigins": [
  "https://summaryr.com",
  "https://www.summaryr.com"
]
```

**Save the configuration** and wait a few seconds for it to propagate.

**Common CORS Issues:**
- If you get `400 Bad Request` or `ERR_CONNECTION_RESET`, CORS is likely not configured
- If you get `403 Forbidden`, check your bucket policy
- Make sure `PUT` is in the `AllowedMethods` array

## Cost Estimation

### S3 Storage Costs (us-east-1)
- **Storage**: $0.023 per GB/month (first 50 TB)
- **PUT requests**: $0.005 per 1,000 requests
- **GET requests**: $0.0004 per 1,000 requests

### CloudFront Costs
- **Data transfer out**: $0.085 per GB (first 10 TB)
- **HTTP/HTTPS requests**: $0.0075 per 10,000 requests

### Example Monthly Cost
- 100 GB storage: ~$2.30
- 10,000 uploads: ~$0.05
- 1 TB CloudFront transfer: ~$85
- **Total**: ~$87/month (much cheaper than Supabase Storage for large files)

## Security Best Practices

1. **Use IAM roles** instead of access keys when possible (for EC2/ECS/Lambda)
2. **Rotate access keys** regularly
3. **Use CloudFront signed URLs** for private content
4. **Enable S3 bucket versioning** for important files
5. **Set up lifecycle policies** to move old files to Glacier
6. **Enable CloudTrail** to audit S3 access
7. **Use bucket policies** to restrict access by IP if needed

## Troubleshooting

### "Access Denied" Errors

1. Check IAM user permissions
2. Verify bucket policy allows your user
3. Check CORS configuration
4. Verify CloudFront origin settings

### Files Not Appearing

1. Check S3 bucket name in environment variables
2. Verify AWS credentials are correct
3. Check CloudWatch logs for errors
4. Verify file upload completed successfully

### CloudFront Not Serving Files

1. Wait 15-30 minutes for distribution to deploy
2. Check origin settings
3. Verify bucket is public or OAC is configured
4. Clear CloudFront cache if needed

### High Costs

1. Enable S3 lifecycle policies to delete old files
2. Use CloudFront caching to reduce S3 requests
3. Consider using S3 Intelligent-Tiering
4. Monitor usage in AWS Cost Explorer

## Migration from Supabase Storage

If you have existing files in Supabase Storage:

1. Download all files from Supabase Storage
2. Upload them to S3 using AWS CLI or console
3. Update database records with new S3 URLs
4. Or write a migration script to transfer files

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS Pricing Calculator](https://calculator.aws/)
- [S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)

## Support

If you encounter issues:
1. Check AWS CloudWatch logs
2. Review S3 access logs
3. Verify all environment variables are set
4. Check AWS service health dashboard

