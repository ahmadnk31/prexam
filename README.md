# Prexam - AI-Powered Study Platform

Transform videos into flashcards and practice questions with AI-powered transcription and generation.

## Features

- 📹 **Video Upload**: Upload video files or paste YouTube URLs
- 🎤 **AI Transcription**: Automatic transcription using OpenAI Whisper
- 🧠 **Flashcard Generation**: Generate flashcards from video transcripts
- ❓ **Question Generation**: Create practice questions (MCQ, True/False, Short Answer, Fill in the Blank)
- 📚 **Study Modes**: 
  - Flashcard study with spaced repetition system (SRS)
  - Interactive quiz mode with scoring
- 🔐 **Authentication**: Secure user authentication with Supabase
- 💾 **Cloud Storage**: Videos stored in Supabase Storage

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **TailwindCSS**
- **Supabase** (Auth + Database + Storage)
- **OpenAI API** (Whisper + GPT-4o-mini)
- **shadcn/ui**

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. **Create Storage Buckets** (IMPORTANT!):
   - **Option A (Recommended)**: Run `supabase/storage-setup.sql` in SQL Editor
   - **Option B (Manual)**: 
     - Go to **Storage** in the left sidebar
     - Click **"New bucket"**
     - Create a bucket named `videos` (exactly this name)
     - Set it as **Public** (recommended) or **Private**
     - Set file size limit (e.g., 1GB)
     - See `SUPABASE_SETUP.md` for detailed instructions and policies
4. Get your Supabase URL and keys from Project Settings > API

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Resend Email Configuration (Optional but recommended)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO=support@yourdomain.com
```

**Resend Setup** (for email functionality):
1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Verify your domain (or use the default `onboarding@resend.dev` for testing)
4. Add the `RESEND_API_KEY` to your `.env.local`
5. Optionally set `RESEND_FROM_EMAIL` and `RESEND_REPLY_TO` for custom sender addresses

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  (auth)/          # Authentication pages
    login/
    signup/
    callback/
  dashboard/        # Main application
    library/        # Video library
    upload/         # Upload page
    videos/
      [id]/         # Video detail page
        flashcards/ # Flashcard study mode
        quiz/       # Quiz mode
  api/              # API routes
    upload/         # Video upload
    process/
      transcribe/   # Transcription
    generate/
      flashcards/   # Flashcard generation
      questions/    # Question generation
components/        # React components
lib/               # Utility functions
supabase/          # Supabase configuration
```

## Usage

1. **Sign Up/Login**: Create an account or login
2. **Upload Video**: Upload a video file or paste a YouTube URL
3. **Wait for Transcription**: The video will be automatically transcribed
4. **Generate Study Materials**: 
   - Click "Generate Flashcards" to create flashcards
   - Click "Generate Questions" to create practice questions
5. **Study**: 
   - Use the flashcard study mode for spaced repetition
   - Take quizzes to test your knowledge

## Database Schema

The application uses the following main tables:

- `profiles` - User profiles
- `videos` - Video metadata
- `video_segments` - Transcript segments
- `flashcards` - Generated flashcards with SRS data
- `questions` - Generated questions
- `quiz_attempts` - Quiz attempt history

See `supabase/schema.sql` for the complete schema.

## Notes

- **YouTube Transcription**: Uses `ytdl-core` library, but YouTube frequently blocks downloads (403 errors). For reliable transcription, download videos and upload the file directly.
- **Video Storage**: Video files are stored in Supabase Storage bucket named `videos`
- **Transcripts**: Automatically chunked into segments with timestamps
- **Flashcards**: Use spaced repetition system (SM-2 algorithm)
- **Questions**: Generated with a mix of types (MCQ, True/False, Short Answer, Fill in the Blank)

## Known Limitations

- **YouTube Downloads**: YouTube frequently changes their API, causing 403 errors. This is a limitation of client-side YouTube download libraries. For production, consider:
  - Using yt-dlp on your server (requires server setup)
  - Asking users to download and upload videos directly
  - Using a YouTube API service (paid)

## License

MIT
