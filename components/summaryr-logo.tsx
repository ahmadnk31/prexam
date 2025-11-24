import React from 'react'
import Image from 'next/image'

interface SummaryrLogoProps {
  className?: string
  size?: number
  showText?: boolean
  variant?: 'default' | 'white' | 'inverted'
}

export default function SummaryrLogo({ 
  className = '', 
  size = 40,
  showText = true,
  variant = 'default'
}: SummaryrLogoProps) {
  const textColor = variant === 'white' || variant === 'inverted' ? 'text-white' : 'text-white'
  
  // For white/inverted variants, we might need a white version of the logo
  // For now, using the default logo with brightness filter for white variant
  const logoFilter = variant === 'white' || variant === 'inverted' 
    ? 'brightness-0 invert' 
    : ''
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Image */}
      <Image
        src="/logo.png"
        alt="Summaryr Logo"
        width={size}
        height={size}
        className={`flex-shrink-0 ${logoFilter} w-full h-10 md:h-12 rounded-xl`}
        priority
      />
      
    </div>
  )
}

