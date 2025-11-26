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
- 💾 **Cloud Storage**: Videos and documents stored in AWS S3 with CloudFront CDN

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **TailwindCSS**
- **Supabase** (Auth + Database)
- **AWS S3 + CloudFront** (File Storage + CDN)
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
3. Get your Supabase URL and keys from Project Settings > API

**Note**: We no longer use Supabase Storage. Files are stored in AWS S3 (see Step 3).

### 3. Set Up AWS S3 + CloudFront

1. Create AWS S3 buckets for videos, documents, and thumbnails
2. Set up CloudFront distribution for CDN
3. Create IAM user with S3 access
4. See `AWS_SETUP.md` for detailed step-by-step instructions

### 4. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_FUNCTION_URL=https://your-project-id.functions.supabase.co
DOCUMENT_PROCESSING_SECRET=some-long-random-string

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_VIDEOS_BUCKET=summaryr-videos
AWS_S3_DOCUMENTS_BUCKET=summaryr-documents
AWS_S3_THUMBNAILS_BUCKET=summaryr-thumbnails

# CloudFront Configuration (optional but recommended)
AWS_CLOUDFRONT_DOMAIN=https://d1234567890.cloudfront.net

# Resend Email Configuration (Optional but recommended)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO=support@yourdomain.com
```

**AWS Setup**:
- See `AWS_SETUP.md` for complete instructions
- Create S3 buckets and CloudFront distribution
- Get IAM credentials and add to `.env.local`

**Resend Setup** (for email functionality):
1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Verify your domain (or use the default `onboarding@resend.dev` for testing)
4. Add the `RESEND_API_KEY` to your `.env.local`
5. Optionally set `RESEND_FROM_EMAIL` and `RESEND_REPLY_TO` for custom sender addresses

### 5. Run the Development Server

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

- **Document Text Extraction** now runs inside a Supabase Edge Function (`process-document`). Deploy it with the Supabase CLI:
  ```bash
  supabase functions deploy process-document --project-ref your-project-ref --env-file supabase/.env.process-document
  ```
  Create `supabase/.env.process-document` (excluded from git) with the AWS, OpenAI, Supabase, and `DOCUMENT_PROCESSING_SECRET` values listed above.
- **YouTube Transcription**: Uses `ytdl-core` library, but YouTube frequently blocks downloads (403 errors). For reliable transcription, download videos and upload the file directly.
- **File Storage**: Videos and documents are stored in AWS S3 with CloudFront CDN for fast global delivery
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
