import { MetadataRoute } from 'next'

function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'https://summaryr.com'
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl()
  const now = new Date()
  
  return [
    // Homepage - highest priority
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Public authentication pages
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    // Main dashboard pages (public routes, but require auth to use)
    {
      url: `${baseUrl}/dashboard/library`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/dashboard/upload`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/dashboard/transcribe`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/dashboard/documents/upload`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]
}

