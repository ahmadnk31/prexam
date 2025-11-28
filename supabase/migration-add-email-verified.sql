-- Migration: Add email_verified field to profiles table
-- This allows tracking email verification status in the profiles table

-- Add email_verified column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified ON public.profiles(email_verified);

-- Update existing profiles based on auth.users email_confirmed_at
UPDATE public.profiles p
SET email_verified = COALESCE(
  (SELECT email_confirmed_at IS NOT NULL 
   FROM auth.users u 
   WHERE u.id = p.id),
  false
);

-- Function to sync email_verified when user email is confirmed
CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profiles.email_verified when auth.users.email_confirmed_at changes
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.profiles
    SET email_verified = true
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync email_verified on auth.users update
DROP TRIGGER IF EXISTS sync_email_verified_trigger ON auth.users;
CREATE TRIGGER sync_email_verified_trigger
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.sync_email_verified();

-- Also update email_verified when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Use ON CONFLICT to handle race conditions gracefully
  INSERT INTO public.profiles (id, email, full_name, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, profiles.email_verified);
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't block signup
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

