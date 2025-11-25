import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Get base URL safely
function getBaseUrl(): URL | undefined {
  try {
    const url = process.env.NEXT_PUBLIC_APP_URL || 'https://summaryr.com'
    // Ensure URL has protocol
    let baseUrl = url
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      // If it's localhost, use http, otherwise https
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        baseUrl = `http://${url}`
      } else {
        baseUrl = `https://${url}`
      }
    }
    return new URL(baseUrl)
  } catch (error) {
    // If URL construction fails, return undefined (Next.js will handle it)
    console.warn('Failed to construct metadataBase URL:', error)
    return undefined
  }
}

const baseUrl = getBaseUrl()
const canonicalUrl = baseUrl?.origin ?? "https://summaryr.com"

export const metadata: Metadata = {
  ...(baseUrl && { metadataBase: baseUrl }),
  applicationName: "Summaryr",
  generator: "Next.js 14",
  category: "education",
  title: {
    default: "Summaryr - AI-Powered Study Platform",
    template: "%s | Summaryr",
  },
  description: "Transform videos and documents into flashcards and practice questions with AI. Study smarter with automated transcription, spaced repetition flashcards, and AI-generated quizzes. Perfect for students and lifelong learners.",
  keywords: [
    "summaryr",
    "study platform",
    "flashcards",
    "video learning",
    "AI education",
    "online learning",
    "quiz generator",
    "spaced repetition",
    "video transcription",
    "study tools",
    "educational technology",
    "document analysis",
    "YouTube learning",
    "AI summary",
    "video summary",
    "document summary",
  ],
  authors: [{ name: "Summaryr" }],
  creator: "Summaryr",
  publisher: "Summaryr",
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "en": "/",
    },
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  referrer: "strict-origin-when-cross-origin",
  appleWebApp: {
    capable: true,
    title: "Summaryr",
    statusBarStyle: "default",
  },
  appLinks: {
    ios: {
      url: canonicalUrl,
    },
    android: {
      package: "com.summaryr.app",
      url: canonicalUrl,
    },
    web: {
      url: canonicalUrl,
      should_fallback: true,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: canonicalUrl,
    siteName: "Summaryr",
    title: "Summaryr - AI-Powered Study Platform",
    description: "Transform videos and documents into flashcards and practice questions with AI. Study smarter with automated transcription, spaced repetition flashcards, and AI-generated quizzes.",
    images: [
      {
        url: `${canonicalUrl}/logo.png`,
        width: 1302,
        height: 367,
        alt: "Summaryr - AI-Powered Study Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Summaryr - AI-Powered Study Platform",
    description: "Transform videos and documents into flashcards and practice questions with AI",
    site: "@summaryr",
    creator: "@summaryr",
    images: [`${canonicalUrl}/logo.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes here when available
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#4B3F72" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
