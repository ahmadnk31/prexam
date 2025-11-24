import { MetadataRoute } from 'next'

function getBaseUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'https://summaryr.com'
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/_next/',
          '/login',
          '/signup',
          '/callback',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

