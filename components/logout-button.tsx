'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import {
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })
      
      if (response.ok) {
        // Clear any client-side state
        window.location.href = '/login'
      } else {
        console.error('Logout failed')
        // Fallback: redirect anyway
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Fallback: redirect anyway
      window.location.href = '/login'
    }
  }

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onClick={handleLogout}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sign Out
    </DropdownMenuItem>
  )
}

