import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createServiceClient } from '@/supabase/service'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email } = body

    const supabase = await createClient()
    const serviceClient = createServiceClient()
    let userEmail: string | undefined
    let userId: string | undefined

    // Try to get user from session first
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.email && user?.id) {
      userEmail = user.email
      userId = user.id
    } else if (email) {
      // If email is provided in body, find user by email
      userEmail = email
      const { data: users } = await serviceClient.auth.admin.listUsers()
      const targetUser = users.users.find((u) => u.email === email)
      if (targetUser) {
        userId = targetUser.id
      }
    } else {
      return NextResponse.json({ error: 'No email address found' }, { status: 400 })
    }

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'User not found or email missing' }, { status: 404 })
    }
    
    const secret = process.env.EMAIL_VERIFICATION_SECRET || 'default-secret-change-in-production'

    // Generate verification token
    const token = crypto
      .createHash('sha256')
      .update(`${userId}${userEmail}${secret}`)
      .digest('hex')

    // Create verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(userEmail)}`

    // Send verification email
    await sendEmail({
      to: userEmail,
      subject: 'Verify your email address - Summaryr',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #4B3F72; margin-top: 0;">Verify Your Email Address</h1>
              <p style="color: #1F2937; line-height: 1.6;">Hi there,</p>
              <p style="color: #1F2937; line-height: 1.6;">Please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background-color: #FBBF24; color: #1F2937 !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; border: 2px solid #FBBF24;">
                  Verify Email
                </a>
              </div>
              <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6B7280; font-size: 12px; background-color: #f3f4f6; padding: 10px; border-radius: 4px;">${verifyUrl}</p>
              <p style="color: #6B7280; font-size: 14px;">This link will expire in 24 hours.</p>
              <p style="color: #6B7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
              <p style="color: #6B7280; font-size: 14px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Summaryr. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
      text: `Verify Your Email Address

Hi there,

Please verify your email address by clicking the link below:

${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

© ${new Date().getFullYear()} Summaryr. All rights reserved.`,
    })

    return NextResponse.json({ success: true, message: 'Verification email sent' })
  } catch (error: any) {
    console.error('Send verification email error:', error)
    return NextResponse.json(
      { error: 'Failed to send verification email', details: error.message },
      { status: 500 }
    )
  }
}

