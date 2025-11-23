import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prexam - AI-Powered Study Platform",
  description: "Transform videos into flashcards and practice questions with AI. Study smarter with automated transcription, spaced repetition flashcards, and AI-generated quizzes.",
  keywords: ["study", "flashcards", "video learning", "AI education", "online learning", "quiz generator"],
  openGraph: {
    title: "Prexam - AI-Powered Study Platform",
    description: "Transform videos into flashcards and practice questions with AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prexam - AI-Powered Study Platform",
    description: "Transform videos into flashcards and practice questions with AI",
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
