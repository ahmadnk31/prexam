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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

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
            <CardTitle className="text-3xl font-bold text-[#4B3F72]">Login</CardTitle>
            <Link 
              href="/" 
              className="flex items-center gap-1 text-sm text-purple-700/70 hover:text-[#4B3F72] font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
          <CardDescription className="text-purple-700/70 font-medium">
            Enter your credentials to access your study materials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}
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
                className="border-purple-200 focus:border-[#4B3F72] focus:ring-[#4B3F72]"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all" 
              disabled={loading}
              size="lg"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
            <div className="text-center text-sm text-purple-700/70 font-medium">
              Don't have an account?{' '}
              <Link href="/signup" className="text-[#4B3F72] hover:text-[#5A4A82] font-semibold underline underline-offset-2">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

