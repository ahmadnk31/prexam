-- Migration: Fix summaries table to allow nullable video_id and document_id
-- The summaries table should allow either video_id OR document_id to be set (not both)

-- First, check if video_id has a NOT NULL constraint and remove it
DO $$
BEGIN
  -- Check if video_id column exists and has NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'summaries' 
    AND column_name = 'video_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.summaries 
    ALTER COLUMN video_id DROP NOT NULL;
  END IF;
END $$;

-- Ensure document_id is also nullable (should already be, but just in case)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'summaries' 
    AND column_name = 'document_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.summaries 
    ALTER COLUMN document_id DROP NOT NULL;
  END IF;
END $$;

-- Ensure the CHECK constraint exists to enforce that one must be set
DO $$
BEGIN
  -- Drop existing constraint if it exists with a different name
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE 'summaries_%_check' 
    AND conrelid = 'public.summaries'::regclass
  ) THEN
    ALTER TABLE public.summaries 
    DROP CONSTRAINT IF EXISTS summaries_video_id_document_id_check;
  END IF;
  
  -- Add the CHECK constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'summaries_video_id_document_id_check' 
    AND conrelid = 'public.summaries'::regclass
  ) THEN
    ALTER TABLE public.summaries 
    ADD CONSTRAINT summaries_video_id_document_id_check 
    CHECK (
      (video_id IS NOT NULL AND document_id IS NULL) OR
      (video_id IS NULL AND document_id IS NOT NULL)
    );
  END IF;
END $$;

