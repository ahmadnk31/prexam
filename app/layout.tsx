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
    const url = process.env.NEXT_PUBLIC_APP_URL || 'https://prexam.com'
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
    default: "Prexam - AI-Powered Study Platform",
    template: "%s | Prexam",
  },
  description: "Transform videos and documents into flashcards and practice questions with AI. Study smarter with automated transcription, spaced repetition flashcards, and AI-generated quizzes. Perfect for students and lifelong learners.",
  keywords: [
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
  ],
  authors: [{ name: "Prexam" }],
  creator: "Prexam",
  publisher: "Prexam",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Prexam",
    title: "Prexam - AI-Powered Study Platform",
    description: "Transform videos and documents into flashcards and practice questions with AI. Study smarter with automated transcription, spaced repetition flashcards, and AI-generated quizzes.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Prexam - AI-Powered Study Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prexam - AI-Powered Study Platform",
    description: "Transform videos and documents into flashcards and practice questions with AI",
    images: ["/og-image.png"],
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
