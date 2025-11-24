'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) throw error

      // Profile is automatically created by database trigger
      // But we can update it with the full_name if provided
      if (data.user) {
        try {
          // Try to update profile if it exists (created by trigger)
          // This is non-blocking - if it fails, the trigger will have created a basic profile
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ full_name: fullName })
            .eq('id', data.user.id)

          if (profileError) {
            // If update fails, try to create it (fallback if trigger didn't work)
            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: data.user.email,
                full_name: fullName,
              })

            if (createError) {
              // Log but don't block - profile can be created later
              console.warn('Profile creation/update failed:', createError)
            }
          }
        } catch (profileError) {
          // Log but don't block signup
          console.warn('Profile update error:', profileError)
        }
      }

      router.push('/dashboard/library')
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center gradient-outseta px-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl border-purple-100">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl font-bold text-[#4B3F72]">Sign Up</CardTitle>
            <Link 
              href="/" 
              className="flex items-center gap-1 text-sm text-purple-700/70 hover:text-[#4B3F72] font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
          <CardDescription className="text-purple-700/70 font-medium">
            Create an account to start studying with AI-powered flashcards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[#4B3F72] font-semibold">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="border-purple-200 focus:border-[#4B3F72] focus:ring-[#4B3F72]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#4B3F72] font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-purple-200 focus:border-[#4B3F72] focus:ring-[#4B3F72]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#4B3F72] font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="border-purple-200 focus:border-[#4B3F72] focus:ring-[#4B3F72]"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all" 
              disabled={loading}
              size="lg"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
            <div className="text-center text-sm text-purple-700/70 font-medium">
              Already have an account?{' '}
              <Link href="/login" className="text-[#4B3F72] hover:text-[#5A4A82] font-semibold underline underline-offset-2">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

