import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { sendEmail, sendWelcomeEmail, sendPasswordResetEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, to, ...options } = body

    // Validate required fields
    if (!type || !to) {
      return NextResponse.json(
        { error: 'Type and recipient email are required' },
        { status: 400 }
      )
    }

    let result

    switch (type) {
      case 'welcome':
        result = await sendWelcomeEmail({
          to,
          userName: options.userName,
          loginUrl: options.loginUrl,
        })
        break

      case 'password-reset':
        if (!options.resetUrl) {
          return NextResponse.json(
            { error: 'resetUrl is required for password reset emails' },
            { status: 400 }
          )
        }
        result = await sendPasswordResetEmail({
          to,
          resetUrl: options.resetUrl,
          userName: options.userName,
        })
        break

      case 'custom':
        if (!options.subject || !options.html) {
          return NextResponse.json(
            { error: 'subject and html are required for custom emails' },
            { status: 400 }
          )
        }
        result = await sendEmail({
          to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
        })
        break

      default:
        return NextResponse.json(
          { error: `Unknown email type: ${type}` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Email API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}

