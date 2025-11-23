import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Brain, 
  Library, 
  Upload, 
  User,
  Menu,
  FileText
} from 'lucide-react'
import LogoutButton from '@/components/logout-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen gradient-outseta-subtle">
      <nav className="sticky top-0 z-50 border-b border-purple-200/50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard/library" className="flex items-center gap-2 text-2xl font-bold text-[#4B3F72] hover:text-[#5A4A82] transition-colors">
            <Brain className="h-7 w-7 text-[#4B3F72]" />
            Prexam
          </Link>
          
          <div className="hidden items-center gap-1 md:flex">
            <Link href="/dashboard/library">
              <Button variant="ghost" className="gap-2 text-[#4B3F72] hover:bg-purple-50 hover:text-[#5A4A82] font-medium">
                <Library className="h-4 w-4" />
                Library
              </Button>
            </Link>
            <Link href="/dashboard/upload">
              <Button variant="ghost" className="gap-2 text-[#4B3F72] hover:bg-purple-50 hover:text-[#5A4A82] font-medium">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </Link>
            <Link href="/dashboard/documents/upload">
              <Button variant="ghost" className="gap-2 text-[#4B3F72] hover:bg-purple-50 hover:text-[#5A4A82] font-medium">
                <FileText className="h-4 w-4" />
                Documents
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 text-[#4B3F72] hover:bg-purple-50 font-medium">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border-purple-100">
                <DropdownMenuLabel className="text-[#4B3F72]">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold">{displayName}</p>
                    <p className="text-xs text-purple-600/70">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-purple-100" />
                <DropdownMenuItem asChild className="text-[#4B3F72] hover:bg-purple-50">
                  <Link href="/dashboard/library" className="w-full">
                    <Library className="mr-2 h-4 w-4" />
                    My Library
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-purple-100" />
                <LogoutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
      <main className="min-h-[calc(100vh-73px)]">{children}</main>
    </div>
  )
}
