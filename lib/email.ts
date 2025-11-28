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
      
      // Handle Resend testing mode limitation
      if (error.statusCode === 403 && error.message?.includes('testing emails')) {
        console.warn('Resend is in testing mode. Only sending to verified email addresses is allowed.')
        console.warn('To send to all recipients, verify a domain at https://resend.com/domains')
        // Don't throw error in development - just log it
        if (process.env.NODE_ENV === 'development') {
          console.warn('Email not sent (Resend testing mode). In production, verify your domain.')
          return { id: 'test-mode', message: 'Email not sent - Resend testing mode' }
        }
      }
      
      throw new Error(`Failed to send email: ${error.message}`)
    }

    return data
  } catch (error: any) {
    console.error('Email sending error:', error)
    
    // In development, don't fail completely if it's a Resend testing mode issue
    if (process.env.NODE_ENV === 'development' && error.message?.includes('testing emails')) {
      console.warn('Skipping email send in development due to Resend testing mode')
      return { id: 'test-mode', message: 'Email not sent - Resend testing mode' }
    }
    
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

  let html: string
  try {
    // render might return a Promise, so handle both cases
    let rendered: any = render(WelcomeEmail({ userName, loginUrl }))
    
    // If it's a Promise, await it
    if (rendered && typeof rendered.then === 'function') {
      rendered = await rendered
    }
    
    // Validate that rendered is a string
    if (!rendered || typeof rendered !== 'string') {
      console.error('Email render failed, html is not a string:', typeof rendered, rendered)
      // Fallback to simple HTML
      html = `<html><body><h1>Welcome to Summaryr! 🎉</h1><p>${text.replace(/\n/g, '<br>')}</p></body></html>`
    } else {
      html = rendered
    }
  } catch (error: any) {
    console.error('Error rendering welcome email template:', error)
    // Fallback to simple HTML if rendering fails
    html = `<html><body><h1>Welcome to Summaryr! 🎉</h1><p>${text.replace(/\n/g, '<br>')}</p></body></html>`
  }

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
  const text = `Hi ${userName || 'there'},

We received a request to reset your password for your Summaryr account. Click the link below to create a new password:

${resetUrl}

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

This link will expire in 1 hour for security reasons.

© ${new Date().getFullYear()} Summaryr. All rights reserved.`

  let html: string
  try {
    // render might return a Promise, so handle both cases
    let rendered: any = render(PasswordResetEmail({ resetUrl, userName }))
    
    // If it's a Promise, await it
    if (rendered && typeof rendered.then === 'function') {
      rendered = await rendered
    }
    
    // Validate that rendered is a string
    if (!rendered || typeof rendered !== 'string') {
      console.error('Email render failed, html is not a string:', typeof rendered, rendered)
      // Fallback to simple HTML
      html = `<html><body><h1>Reset your Summaryr password</h1><p>${text.replace(/\n/g, '<br>')}</p></body></html>`
    } else {
      html = rendered
    }
  } catch (error: any) {
    console.error('Error rendering password reset email template:', error)
    // Fallback to simple HTML if rendering fails
    html = `<html><body><h1>Reset your Summaryr password</h1><p>${text.replace(/\n/g, '<br>')}</p></body></html>`
  }

  return sendEmail({
    to,
    subject: 'Reset your Summaryr password',
    html,
    text,
  })
}

