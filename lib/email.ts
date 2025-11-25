import { render } from '@react-email/render'
import { resend, getFromEmail, getReplyToEmail } from './resend'
import { WelcomeEmail } from '@/emails/welcome-email'
import { PasswordResetEmail } from '@/emails/password-reset-email'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: SendEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo || getReplyToEmail(),
    })

    if (error) {
      console.error('Resend error:', error)
      throw new Error(`Failed to send email: ${error.message}`)
    }

    return data
  } catch (error: any) {
    console.error('Email sending error:', error)
    throw error
  }
}

/**
 * Send a welcome email to a new user
 */
export async function sendWelcomeEmail({
  to,
  userName,
  loginUrl,
}: {
  to: string
  userName?: string
  loginUrl?: string
}) {
  const html = render(WelcomeEmail({ userName, loginUrl }))
  const text = `Welcome to Summaryr, ${userName || 'there'}!

We're thrilled to have you join Summaryr! You're now part of a community that's transforming the way students learn and study.

With Summaryr, you can:
• Upload videos and documents to create study materials
• Generate AI-powered flashcards with spaced repetition
• Create practice quizzes to test your knowledge
• Get instant transcriptions and summaries

Get started: ${loginUrl || 'https://summaryr.com/login'}

Happy studying,
The Summaryr Team`

  return sendEmail({
    to,
    subject: 'Welcome to Summaryr! 🎉',
    html,
    text,
  })
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
  userName,
}: {
  to: string
  resetUrl: string
  userName?: string
}) {
  const html = render(PasswordResetEmail({ resetUrl, userName }))
  const text = `Hi ${userName || 'there'},

We received a request to reset your password for your Summaryr account. Click the link below to create a new password:

${resetUrl}

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

This link will expire in 1 hour for security reasons.

© ${new Date().getFullYear()} Summaryr. All rights reserved.`

  return sendEmail({
    to,
    subject: 'Reset your Summaryr password',
    html,
    text,
  })
}

