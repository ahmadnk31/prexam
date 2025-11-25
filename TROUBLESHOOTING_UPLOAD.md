# Troubleshooting Video Upload Issues

## Common Error: 400 Bad Request from S3

If you're getting `400 (Bad Request)` or `ERR_CONNECTION_RESET` when uploading videos, follow these steps:

### Step 1: Configure CORS (REQUIRED)

**This is the most common cause of 400 errors.**

1. Go to AWS S3 Console → Your bucket (`summaryr-videos`)
2. Click **"Permissions"** tab
3. Scroll to **"Cross-origin resource sharing (CORS)"**
4. Click **"Edit"** and paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-server-side-encryption", "x-amz-request-id", "x-amz-id-2"],
    "MaxAgeSeconds": 3000
  }
]
```

5. **Save** and wait 30 seconds

### Step 2: Check Bucket Policy

1. Go to **"Permissions"** tab → **"Bucket policy"**
2. Ensure it allows PUT requests:

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
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::summaryr-videos/*"
    }
  ]
}
```

### Step 3: Check Object Ownership

1. Go to **"Permissions"** tab → **"Object Ownership"**
2. If it says **"ACLs disabled (recommended)"**, you have two options:

**Option A: Enable ACLs (Quick Fix)**
- Click **"Edit"**
- Select **"ACLs enabled (recommended)"**
- Check **"Bucket owner preferred"**
- Save

**Option B: Keep ACLs Disabled (Recommended)**
- Keep ACLs disabled
- Ensure bucket policy allows PUT (see Step 2)
- The code doesn't use ACLs in presigned URLs, so this should work

### Step 4: Verify AWS Credentials

Check your `.env.local` file has:

```env
AWS_REGION=eu-central-1  # Your region
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_VIDEOS_BUCKET=summaryr-videos
```

### Step 5: Test the Presigned URL

1. Open browser console (F12)
2. Try uploading a video
3. Check the console for:
   - "Presigned URL received" - confirms URL was generated
   - "Starting S3 upload" - confirms upload started
   - Error details - will show the exact S3 error

### Step 6: Check IAM Permissions

Your IAM user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::summaryr-videos/*"
    }
  ]
}
```

## Still Not Working?

1. **Check browser console** for detailed error messages
2. **Check server logs** for presigned URL generation errors
3. **Try a small test file** (< 1MB) to rule out size issues
4. **Verify the presigned URL** - it should start with `https://summaryr-videos.s3.eu-central-1.amazonaws.com/...`

## Quick Test

Run this in your browser console after clicking upload:

```javascript
// Check if CORS is configured
fetch('https://summaryr-videos.s3.eu-central-1.amazonaws.com/', {
  method: 'OPTIONS',
  headers: {
    'Origin': window.location.origin,
    'Access-Control-Request-Method': 'PUT'
  }
}).then(r => console.log('CORS test:', r.status, r.headers.get('access-control-allow-origin')))
```

If this fails or returns an error, CORS is not configured correctly.

