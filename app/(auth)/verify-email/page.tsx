'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    const messageParam = searchParams.get('message')

    if (success === 'true') {
      setStatus('success')
      setMessage('Your email has been verified successfully!')
    } else if (error) {
      setStatus('error')
      switch (error) {
        case 'invalid_token':
          setMessage('Invalid or expired verification link. Please request a new one.')
          break
        case 'user_not_found':
          setMessage('User not found. Please sign up again.')
          break
        case 'verification_failed':
          setMessage('Verification failed. Please try again.')
          break
        default:
          setMessage('An error occurred during verification.')
      }
    } else if (messageParam) {
      setStatus('error')
      setMessage(messageParam)
    } else {
      setStatus('loading')
      setMessage('Please check your email and click the verification link.')
    }
  }, [searchParams])

  const handleResendVerification = async () => {
    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
      })

      if (response.ok) {
        setMessage('Verification email sent! Please check your inbox.')
      } else {
        const data = await response.json()
        setMessage(data.error || 'Failed to send verification email')
      }
    } catch (error) {
      setMessage('Failed to send verification email. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center gradient-outseta px-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl border-purple-100">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold text-[#4B3F72]">
            Email Verification
          </CardTitle>
          <CardDescription className="text-purple-700/70 font-medium">
            {status === 'loading' && 'Verifying your email address...'}
            {status === 'success' && 'Email verified successfully!'}
            {status === 'error' && 'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-700">{message}</p>

          {status === 'success' && (
            <div className="space-y-4">
              <Button
                onClick={() => router.push('/dashboard/library')}
                className="w-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold"
              >
                Go to Dashboard
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <Button
                onClick={handleResendVerification}
                className="w-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold"
              >
                Resend Verification Email
              </Button>
              <div className="text-center">
                <Link
                  href="/login"
                  className="text-[#4B3F72] hover:text-[#5A4A82] font-semibold underline"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4B3F72]"></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

