# Resend Email Setup Guide

This guide will help you set up Resend for sending emails in your Summaryr application.

## Step 1: Sign Up for Resend

1. Go to [https://resend.com](https://resend.com)
2. Click **"Sign Up"** or **"Get Started"**
3. Sign up with your email address or GitHub account
4. Verify your email address if required

## Step 2: Get Your API Key

1. After logging in, you'll be taken to the Resend Dashboard
2. Click on **"API Keys"** in the left sidebar (or go to [https://resend.com/api-keys](https://resend.com/api-keys))
3. Click **"Create API Key"**
4. Give it a name (e.g., "Summaryr Production" or "Summaryr Development")
5. Select the permissions:
   - For development: Select **"Full Access"** (or just **"Sending Access"**)
   - For production: Select **"Sending Access"** only (more secure)
6. Click **"Add"**
7. **IMPORTANT**: Copy the API key immediately - you won't be able to see it again!
   - It will look something like: `re_123456789abcdefghijklmnopqrstuvwxyz`

## Step 3: Add API Key to Your Project

1. Open your `.env.local` file in the root of your project
2. Add the following line:
   ```env
   RESEND_API_KEY=re_123456789abcdefghijklmnopqrstuvwxyz
   ```
   (Replace with your actual API key)

3. Save the file
4. Restart your Next.js development server if it's running

## Step 4: Set Up Email Addresses (Optional but Recommended)

### Option A: Use Resend's Default Email (For Testing)

If you're just testing, you can use Resend's default email address:

```env
RESEND_API_KEY=re_your_api_key_here
# Don't set RESEND_FROM_EMAIL - it will use onboarding@resend.dev by default
```

**Note**: Emails sent from `onboarding@resend.dev` may go to spam. For production, use a verified domain.

### Option B: Verify Your Own Domain (Recommended for Production)

1. In the Resend Dashboard, go to **"Domains"** (or [https://resend.com/domains](https://resend.com/domains))
2. Click **"Add Domain"**
3. Enter your domain (e.g., `summaryr.com` or `yourdomain.com`)
4. Resend will provide DNS records you need to add:
   - **SPF Record**: Authorizes Resend to send emails
   - **DKIM Record**: Adds email authentication
   - **DMARC Record** (optional): Email security policy
5. Add these DNS records to your domain's DNS settings:
   - Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
   - Find DNS settings / DNS management
   - Add the TXT records provided by Resend
   - Wait for DNS propagation (usually 5-60 minutes)
6. Once verified (green checkmark in Resend), you can use:
   ```env
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   RESEND_REPLY_TO=support@yourdomain.com
   ```

### Option C: Use a Subdomain (Easier Setup)

You can also use a subdomain like `mail.yourdomain.com`:
- Add the subdomain in Resend
- Add DNS records for the subdomain
- Use: `RESEND_FROM_EMAIL=noreply@mail.yourdomain.com`

## Step 5: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Sign up a new account on your app
3. Check your email inbox (and spam folder) for the welcome email
4. If you don't receive it, check:
   - Resend Dashboard → **"Logs"** to see if the email was sent
   - Check for any error messages
   - Verify your API key is correct

## Troubleshooting

### Email Not Sending?

1. **Check Resend Dashboard Logs**:
   - Go to [https://resend.com/emails](https://resend.com/emails)
   - Look for failed emails and error messages

2. **Verify API Key**:
   - Make sure `RESEND_API_KEY` is in `.env.local` (not `.env`)
   - Restart your dev server after adding the key
   - Check for typos in the API key

3. **Check Domain Verification**:
   - If using a custom domain, ensure DNS records are added correctly
   - Wait for DNS propagation (can take up to 24 hours)
   - Check domain status in Resend Dashboard

4. **Check Email Limits**:
   - Free tier: 3,000 emails/month
   - Check your usage in the Resend Dashboard

### Emails Going to Spam?

1. **Use a verified domain** (not `onboarding@resend.dev`)
2. **Set up SPF, DKIM, and DMARC records** properly
3. **Warm up your domain** by sending emails gradually
4. **Use a proper "From" name** in your email templates

## Resend Pricing

- **Free Tier**: 3,000 emails/month, 100 emails/day
- **Pro Tier**: $20/month for 50,000 emails
- See [https://resend.com/pricing](https://resend.com/pricing) for details

## Quick Reference

**Where to find your API key:**
- Dashboard: [https://resend.com/api-keys](https://resend.com/api-keys)

**Where to verify domains:**
- Dashboard: [https://resend.com/domains](https://resend.com/domains)

**Where to view email logs:**
- Dashboard: [https://resend.com/emails](https://resend.com/emails)

**Resend Documentation:**
- [https://resend.com/docs](https://resend.com/docs)

## Example .env.local File

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Resend (Email)
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO=support@yourdomain.com
```

## Need Help?

- Resend Support: [https://resend.com/support](https://resend.com/support)
- Resend Docs: [https://resend.com/docs](https://resend.com/docs)
- Check the Resend Dashboard for detailed error messages

