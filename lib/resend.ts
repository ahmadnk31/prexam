import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set in environment variables')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Get the from email address from env or use a default
export const getFromEmail = () => {
  return process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
}

// Get the reply-to email address
export const getReplyToEmail = () => {
  return process.env.RESEND_REPLY_TO || 'noreply@summaryr.com'
}

