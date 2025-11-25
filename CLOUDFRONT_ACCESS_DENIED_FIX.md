# Fix CloudFront "Access Denied" Error

If you're seeing `<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>` from CloudFront, follow these steps:

## Quick Fix: Update S3 Bucket Policy

The most common cause is that your S3 bucket policy doesn't allow CloudFront to access objects. Here's how to fix it:

### Step 1: Get Your CloudFront Distribution ID

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Find your distribution
3. Copy the **Distribution ID** (e.g., `E1234567890ABC`)

### Step 2: Update Your S3 Bucket Policy

1. Go to [S3 Console](https://console.aws.amazon.com/s3/)
2. Click on your bucket (e.g., `summaryr`)
3. Go to **"Permissions"** tab
4. Scroll to **"Bucket policy"**
5. Click **"Edit"** and replace with this policy (replace `YOUR_BUCKET_NAME` and `YOUR_CLOUDFRONT_DISTRIBUTION_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_CLOUDFRONT_DISTRIBUTION_ID"
        }
      }
    },
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    },
    {
      "Sid": "AllowPublicUpload",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

**Replace:**
- `YOUR_BUCKET_NAME` with your bucket name (e.g., `summaryr`)
- `YOUR_CLOUDFRONT_DISTRIBUTION_ID` with your CloudFront distribution ID
- `YOUR_ACCOUNT_ID` with your AWS account ID (found in IAM console, top right)

### Step 3: Verify CloudFront Origin Settings

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click on your distribution
3. Go to **"Origins"** tab
4. Click on your origin
5. Verify:
   - **Origin access**: Should be **"Public"** (or if using OAC, make sure it's configured correctly)
   - **Origin domain**: Should be `YOUR_BUCKET_NAME.s3.YOUR_REGION.amazonaws.com`
   - **Origin path**: Leave empty (unless you have a specific path)

### Step 4: Check Origin Access Control (OAC) Settings (if applicable)

If you're using OAC (Origin Access Control):

1. In CloudFront, go to your origin settings
2. Note the OAC name
3. Go to S3 bucket → Permissions → Bucket policy
4. Make sure the policy includes the OAC principal

**Alternative: Use Public Access (Simpler)**

If you want to keep it simple, you can use public access:

1. In CloudFront origin settings, select **"Public"** for Origin access
2. In S3 bucket:
   - **Block Public Access**: Uncheck "Block all public access"
   - **Bucket Policy**: Use the public read policy (second statement in the policy above)

### Step 5: Invalidate CloudFront Cache (if needed)

After updating the bucket policy, you may need to invalidate the cache:

1. Go to CloudFront distribution
2. Go to **"Invalidations"** tab
3. Click **"Create invalidation"**
4. Enter `/*` to invalidate all files
5. Click **"Create invalidation"**

### Step 6: Wait and Test

1. Wait 5-10 minutes for changes to propagate
2. Test accessing a file directly via CloudFront URL
3. Test accessing a file via your application

## Common Issues

### Issue 1: "Access Denied" even with public bucket

**Solution**: Make sure:
- Block Public Access is disabled in S3
- Bucket policy allows `s3:GetObject` for `*` principal
- CloudFront origin is set to "Public"

### Issue 2: Works with S3 URL but not CloudFront

**Solution**: 
- Check CloudFront distribution status (should be "Deployed")
- Verify the origin domain matches your bucket
- Check if there's a CORS issue (add CORS configuration to bucket)

### Issue 3: CORS Errors

**Solution**: Add CORS configuration to your S3 bucket:

1. Go to S3 bucket → Permissions → CORS
2. Add this configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Testing

Test your setup:

1. **Direct S3 URL** (should work):
   ```
   https://YOUR_BUCKET_NAME.s3.YOUR_REGION.amazonaws.com/videos/USER_ID/FILE_NAME.mp4
   ```

2. **CloudFront URL** (should work after fix):
   ```
   https://YOUR_CLOUDFRONT_DOMAIN/videos/USER_ID/FILE_NAME.mp4
   ```

If both work, your setup is correct!

