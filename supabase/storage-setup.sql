-- Create videos storage bucket
-- Run this in Supabase SQL Editor after creating your project

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,  -- Set to true for public access, false for private
  1073741824,  -- 1GB file size limit (adjust as needed)
  ARRAY['video/*', 'audio/*', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp3', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own videos" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own videos" ON storage.objects;

-- Policy 1: Allow authenticated users to upload videos
CREATE POLICY "Users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow authenticated users to read their own videos
-- Files are stored as: {user_id}/{filename}
CREATE POLICY "Users can read own videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 3: Allow authenticated users to delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

-- Policy 4: Allow service role full access (needed for transcription)
CREATE POLICY "Service role can manage videos"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');

-- Optional: Create thumbnails bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  true,  -- Thumbnails are usually public
  10485760,  -- 10MB limit for thumbnails
  ARRAY['image/*']
)
ON CONFLICT (id) DO NOTHING;

-- Thumbnails policies
DROP POLICY IF EXISTS "Users can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public can read thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own thumbnails" ON storage.objects;

CREATE POLICY "Users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "Public can read thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

CREATE POLICY "Users can delete own thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'thumbnails' AND
  (storage.foldername(name))[1] = (auth.uid())::text
);

