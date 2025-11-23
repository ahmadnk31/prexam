# Supabase Storage Bucket Setup Guide

## Step-by-Step Instructions

### 1. Go to Your Supabase Project
1. Visit [https://supabase.com](https://supabase.com)
2. Sign in and select your project

### 2. Navigate to Storage
1. Click on **Storage** in the left sidebar
2. You'll see a list of buckets (may be empty)

### 3. Create the `videos` Bucket

1. Click the **"New bucket"** button (or **"Create bucket"**)
2. Fill in the bucket details:
   - **Name**: `videos` (must be exactly "videos")
   - **Public bucket**: 
     - ✅ **Check this** if you want videos to be publicly accessible via URL
     - ❌ **Uncheck** if you want authenticated access only
   - **File size limit**: Set to a reasonable limit (e.g., 500MB or 1GB)
   - **Allowed MIME types**: Leave empty or add: `video/*, audio/*`
3. Click **"Create bucket"**

### 4. Set Up Bucket Policies (Important!)

After creating the bucket, you need to set up policies so users can upload files:

1. Click on the **`videos`** bucket you just created
2. Go to the **"Policies"** tab
3. Click **"New Policy"**

#### Policy 1: Allow authenticated users to upload files
- **Policy name**: "Users can upload videos"
- **Allowed operation**: INSERT
- **Policy definition**:
```sql
(bucket_id = 'videos'::text) AND (auth.role() = 'authenticated'::text)
```

#### Policy 2: Allow authenticated users to read their own files
- **Policy name**: "Users can read own videos"
- **Allowed operation**: SELECT
- **Policy definition**:
```sql
(bucket_id = 'videos'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

#### Policy 3: Allow service role to manage all files (for transcription)
- **Policy name**: "Service role can manage videos"
- **Allowed operation**: ALL
- **Policy definition**:
```sql
(bucket_id = 'videos'::text)
```

**Note**: The service role policy allows the backend to download videos for transcription. This is necessary for the transcription process.

### 5. (Optional) Create `thumbnails` Bucket

If you want to store video thumbnails separately:

1. Create a new bucket named `thumbnails`
2. Set it as **Public** (thumbnails are usually public)
3. Apply similar policies

## Quick SQL Setup (Alternative)

You can also create the bucket using SQL in the Supabase SQL Editor:

```sql
-- Create videos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,  -- Set to false for private bucket
  1073741824,  -- 1GB limit
  ARRAY['video/*', 'audio/*']
)
ON CONFLICT (id) DO NOTHING;

-- Create policies
-- Policy 1: Allow authenticated users to upload
CREATE POLICY "Users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Policy 2: Allow authenticated users to read their own files
CREATE POLICY "Users can read own videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 3: Allow service role full access
CREATE POLICY "Service role can manage videos"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');
```

## Verify Setup

After creating the bucket:

1. Go to **Storage** → **`videos`** bucket
2. You should see the bucket listed
3. Try uploading a test file to verify it works

## Troubleshooting

**Error: "Bucket not found"**
- Make sure the bucket name is exactly `videos` (lowercase)
- Check that the bucket was created successfully

**Error: "Permission denied"**
- Check that the policies are set up correctly
- Make sure you're using the service role key for server-side operations

**Error: "File too large"**
- Increase the file size limit in bucket settings
- Or upload smaller video files

## Bucket Settings Recommendations

- **Public bucket**: ✅ Recommended (makes video URLs accessible)
- **File size limit**: 1GB (1073741824 bytes) or higher
- **Allowed MIME types**: `video/*, audio/*` or leave empty for all types

