-- Migration: Add RLS policies for summaries and notes tables
-- This ensures Row Level Security is properly configured

-- Enable RLS on summaries table (if not already enabled)
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- Enable RLS on notes table (if not already enabled)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own summaries" ON public.summaries;
DROP POLICY IF EXISTS "Users can create own summaries" ON public.summaries;
DROP POLICY IF EXISTS "Users can update own summaries" ON public.summaries;
DROP POLICY IF EXISTS "Users can delete own summaries" ON public.summaries;

DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

-- Summaries policies
CREATE POLICY "Users can view own summaries" ON public.summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own summaries" ON public.summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own summaries" ON public.summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own summaries" ON public.summaries
  FOR DELETE USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

