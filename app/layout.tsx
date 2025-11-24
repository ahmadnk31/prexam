import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  ...(baseUrl && { metadataBase: baseUrl }),
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
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Summaryr",
    title: "Summaryr - AI-Powered Study Platform",
    description: "Transform videos and documents into flashcards and practice questions with AI. Study smarter with automated transcription, spaced repetition flashcards, and AI-generated quizzes.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Summaryr - AI-Powered Study Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Summaryr - AI-Powered Study Platform",
    description: "Transform videos and documents into flashcards and practice questions with AI",
    images: ["/logo.png"],
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
      </body>
    </html>
  );
}
