# How to Find Your Supabase Keys

## Step-by-Step Instructions

### 1. Go to Your Supabase Project
1. Visit [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project (or create a new one if you haven't)

### 2. Navigate to API Settings
1. Click on the **Settings** icon (⚙️ gear icon) in the left sidebar
2. Click on **API** in the settings menu

### 3. Find Your Keys
You'll see a section called **Project API keys** with two keys:

#### **anon / public key** (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- This is the **public** key
- Safe to use in browser/client code
- Starts with `eyJhbGc...`
- Copy this value

#### **service_role key** (for `SUPABASE_SERVICE_ROLE_KEY`)
- This is the **secret** key
- ⚠️ **NEVER expose this in client code**
- Also starts with `eyJhbGc...` (but different value)
- Click the **eye icon** 👁️ to reveal it
- Copy this value

### 4. Also Get Your Project URL
- Look for **Project URL** at the top of the API settings page
- Copy this value (for `NEXT_PUBLIC_SUPABASE_URL`)
- Format: `https://xxxxxxxxxxxxx.supabase.co`

### 5. Add to Your `.env.local` File
Create or edit `.env.local` in your project root:

```env
# Project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Public key (safe for browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key_here

# Secret key (server-only, keep private!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_service_role_key_here

# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-...your_openai_key_here

# YouTube Data API v3 Key (optional, but recommended for reliable captions)
# Get from https://console.cloud.google.com/apis/credentials
# Free tier: 10,000 units/day (~50 caption downloads/day)
YOUTUBE_API_KEY=AIza...your_youtube_api_key_here

# App URL (for development)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Visual Guide

```
Supabase Dashboard
├── Settings (⚙️)
    └── API
        ├── Project URL: https://xxxxx.supabase.co
        └── Project API keys
            ├── anon / public: eyJhbGc... ← Copy this
            └── service_role: eyJhbGc... ← Copy this (click 👁️ to reveal)
```

## Important Notes

1. **Never commit `.env.local` to Git** - it should already be in `.gitignore`
2. **Service Role Key is Secret** - treat it like a password
3. **Anon Key is Public** - safe to use in browser code
4. **Restart your dev server** after adding env variables:
   ```bash
   npm run dev
   ```

## Quick Checklist

- [ ] Found Project URL
- [ ] Copied anon/public key
- [ ] Revealed and copied service_role key
- [ ] Added all keys to `.env.local`
- [ ] Restarted dev server

## Troubleshooting

**Can't see the service_role key?**
- Click the eye icon 👁️ next to "service_role" to reveal it
- It might be hidden by default for security

**Still getting errors?**
- Make sure you copied the entire key (they're long!)
- Check for extra spaces or line breaks
- Restart your dev server after adding env variables
- Verify the keys are in `.env.local` (not `.env`)

---

## YouTube API Key Setup (Optional - Limited Use)

⚠️ **Important Limitation**: The YouTube Data API v3 `captions.download` method **only works for videos you own**. For public videos, the API will return a 403 error. The unofficial transcript method works better for public videos.

### When YouTube API Key is Useful:
- ✅ You own the videos you want to transcribe
- ✅ You need to manage captions for your own channel
- ✅ You want to use other YouTube API features

### For Public Videos:
- ❌ Official API won't work (permission denied)
- ✅ Unofficial transcript method works better
- ✅ No API key needed for public videos

### How to Get a YouTube API Key:

1. **Go to Google Cloud Console**
   - Visit [https://console.cloud.google.com](https://console.cloud.google.com)
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click the project dropdown at the top
   - Click "New Project" or select an existing one

3. **Enable YouTube Data API v3**
   - Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
   - Search for "YouTube Data API v3"
   - Click on it and click "Enable"

4. **Create API Key**
   - Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
   - Click "Create Credentials" > "API Key"
   - Copy the API key (starts with `AIza...`)

5. **Optional: Restrict API Key** (Recommended for production)
   - Click on the API key you just created
   - Under "API restrictions", select "Restrict key"
   - Choose "YouTube Data API v3"
   - Save

6. **Add to `.env.local`**
   ```env
   YOUTUBE_API_KEY=AIza...your_api_key_here
   ```

7. **Restart your dev server**

### Pricing:
- **Free tier**: 10,000 units/day
- **Captions.download**: 200 units per request
- **So you can do ~50 caption downloads per day for free**
- After that, it's $0.10 per 1,000 additional units

### Note:
- **For public videos**: The unofficial method works better and doesn't require an API key
- **For your own videos**: The official API works but requires OAuth setup (not just API key)
- **Current implementation**: Uses unofficial method for public videos, which is more reliable for this use case
- The API key is mainly useful if you plan to extend the app to manage your own video captions

