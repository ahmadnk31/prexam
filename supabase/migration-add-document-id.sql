-- Migration: Add document_id column to summaries table if it doesn't exist
-- This migration fixes the error: column summaries.document_id does not exist

-- Add document_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'summaries' 
    AND column_name = 'document_id'
  ) THEN
    ALTER TABLE public.summaries 
    ADD COLUMN document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint for document_id + user_id (partial index for when document_id is not null)
-- Only create if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'summaries' 
    AND column_name = 'document_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'summaries' 
      AND indexname = 'summaries_document_id_user_id_unique'
    ) THEN
      CREATE UNIQUE INDEX summaries_document_id_user_id_unique 
      ON public.summaries(document_id, user_id) 
      WHERE document_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Add unique constraint for video_id + user_id (partial index for when video_id is not null)
-- This might already exist, but we'll create it if it doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'summaries' 
    AND indexname = 'summaries_video_id_user_id_unique'
  ) THEN
    CREATE UNIQUE INDEX summaries_video_id_user_id_unique 
    ON public.summaries(video_id, user_id) 
    WHERE video_id IS NOT NULL;
  END IF;
END $$;

