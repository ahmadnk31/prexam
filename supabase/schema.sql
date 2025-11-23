-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Videos table
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  youtube_url TEXT,
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'transcribing', 'ready', 'error')),
  duration INTEGER, -- in seconds
  file_size BIGINT, -- in bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Video segments (transcript chunks)
CREATE TABLE IF NOT EXISTS public.video_segments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  segment_index INTEGER NOT NULL,
  start_time DECIMAL(10, 2) NOT NULL, -- in seconds
  end_time DECIMAL(10, 2) NOT NULL, -- in seconds
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(video_id, segment_index)
);

-- Flashcards table
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  -- Spaced Repetition System fields
  ease_factor DECIMAL(5, 2) DEFAULT 2.5,
  interval INTEGER DEFAULT 1, -- days
  repetitions INTEGER DEFAULT 0,
  next_review_date TIMESTAMP WITH TIME ZONE,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'true_false', 'short_answer', 'fill_blank')),
  question TEXT NOT NULL,
  options JSONB, -- For MCQ: ["option1", "option2", ...]
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Quiz attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  time_taken INTEGER, -- in seconds
  answers JSONB NOT NULL, -- { question_id: answer }
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(video_id, user_id) -- One note per user per video
);

-- Summaries table
CREATE TABLE IF NOT EXISTS public.summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(video_id, user_id) -- One summary per user per video
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_video_segments_video_id ON public.video_segments(video_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_video_id ON public.flashcards(video_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON public.flashcards(next_review_date);
CREATE INDEX IF NOT EXISTS idx_questions_video_id ON public.questions(video_id);
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_video_id ON public.quiz_attempts(video_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_video_id ON public.notes(video_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_video_id ON public.summaries(video_id);
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON public.summaries(user_id);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Videos policies
DROP POLICY IF EXISTS "Users can view own videos" ON public.videos;
CREATE POLICY "Users can view own videos" ON public.videos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own videos" ON public.videos;
CREATE POLICY "Users can create own videos" ON public.videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own videos" ON public.videos;
CREATE POLICY "Users can update own videos" ON public.videos
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own videos" ON public.videos;
CREATE POLICY "Users can delete own videos" ON public.videos
  FOR DELETE USING (auth.uid() = user_id);

-- Video segments policies
DROP POLICY IF EXISTS "Users can view segments of own videos" ON public.video_segments;
CREATE POLICY "Users can view segments of own videos" ON public.video_segments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.videos
      WHERE videos.id = video_segments.video_id
      AND videos.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can manage segments" ON public.video_segments;
CREATE POLICY "Service role can manage segments" ON public.video_segments
  FOR ALL USING (true);

-- Flashcards policies
DROP POLICY IF EXISTS "Users can view own flashcards" ON public.flashcards;
CREATE POLICY "Users can view own flashcards" ON public.flashcards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own flashcards" ON public.flashcards;
CREATE POLICY "Users can create own flashcards" ON public.flashcards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own flashcards" ON public.flashcards;
CREATE POLICY "Users can update own flashcards" ON public.flashcards
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own flashcards" ON public.flashcards;
CREATE POLICY "Users can delete own flashcards" ON public.flashcards
  FOR DELETE USING (auth.uid() = user_id);

-- Questions policies
DROP POLICY IF EXISTS "Users can view own questions" ON public.questions;
CREATE POLICY "Users can view own questions" ON public.questions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own questions" ON public.questions;
CREATE POLICY "Users can create own questions" ON public.questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own questions" ON public.questions;
CREATE POLICY "Users can update own questions" ON public.questions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own questions" ON public.questions;
CREATE POLICY "Users can delete own questions" ON public.questions
  FOR DELETE USING (auth.uid() = user_id);

-- Quiz attempts policies
DROP POLICY IF EXISTS "Users can view own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view own quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can create own quiz attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notes policies
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
CREATE POLICY "Users can create own notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

-- Summaries policies
DROP POLICY IF EXISTS "Users can view own summaries" ON public.summaries;
CREATE POLICY "Users can view own summaries" ON public.summaries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own summaries" ON public.summaries;
CREATE POLICY "Users can create own summaries" ON public.summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own summaries" ON public.summaries;
CREATE POLICY "Users can update own summaries" ON public.summaries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own summaries" ON public.summaries;
CREATE POLICY "Users can delete own summaries" ON public.summaries
  FOR DELETE USING (auth.uid() = user_id);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_flashcards_updated_at ON public.flashcards;
CREATE TRIGGER update_flashcards_updated_at BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_questions_updated_at ON public.questions;
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_summaries_updated_at ON public.summaries;
CREATE TRIGGER update_summaries_updated_at BEFORE UPDATE ON public.summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

