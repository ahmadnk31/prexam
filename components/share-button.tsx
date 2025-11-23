'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Share2, Check, Copy } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ShareButtonProps {
  videoId: string
  videoTitle: string
}

export default function ShareButton({ videoId, videoTitle }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/dashboard/videos/${videoId}`
    : ''

  const handleCopy = async () => {
    if (!shareUrl) return
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShare = async () => {
    if (!shareUrl) return

    const shareData = {
      title: videoTitle,
      text: `Check out this study material: ${videoTitle}`,
      url: shareUrl,
    }

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        // Fallback to copy
        handleCopy()
      }
    } catch (err) {
      // User cancelled or error occurred
      console.error('Error sharing:', err)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Share Video</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share via...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="text-xs text-gray-500 mb-1">Share URL:</p>
          <p className="text-xs font-mono text-gray-700 break-all">{shareUrl}</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

