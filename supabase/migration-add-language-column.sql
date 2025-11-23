-- Migration: Add language column to documents table if it doesn't exist
-- This migration fixes the error: column documents.language does not exist

-- Add language column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'language'
  ) THEN
    ALTER TABLE public.documents 
    ADD COLUMN language TEXT;
  END IF;
END $$;

