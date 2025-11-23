'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RotateCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { updateFlashcardSRS } from '@/lib/flashcards'
import { createClient } from '@/supabase/client'

interface Flashcard {
  id: string
  front: string
  back: string
  ease_factor: number
  interval: number
  repetitions: number
  next_review_date: string | null
}

interface FlashcardStudyProps {
  flashcards: Flashcard[]
  videoId: string
  isDocument?: boolean
}

export default function FlashcardStudy({
  flashcards,
  videoId,
  isDocument = false,
}: FlashcardStudyProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [quality, setQuality] = useState<number | null>(null)

  const currentCard = flashcards[currentIndex]
  const progress = ((currentIndex + 1) / flashcards.length) * 100

  const handleQuality = async (selectedQuality: number) => {
    if (!currentCard) return

    setQuality(selectedQuality)

    // Update SRS
    const srsData = updateFlashcardSRS(
      currentCard.ease_factor,
      currentCard.interval,
      currentCard.repetitions,
      selectedQuality
    )

    // Update in database
    const supabase = createClient()
    const tableName = isDocument ? 'document_flashcards' : 'flashcards'
    await supabase
      .from(tableName)
      .update({
        ease_factor: srsData.easeFactor,
        interval: srsData.interval,
        repetitions: srsData.repetitions,
        next_review_date: srsData.nextReviewDate.toISOString(),
        last_reviewed_at: new Date().toISOString(),
      })
      .eq('id', currentCard.id)

    // Move to next card
    setTimeout(() => {
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setIsFlipped(false)
        setQuality(null)
      } else {
        // Completed
        alert('You\'ve completed all flashcards!')
      }
    }, 500)
  }

  const nextCard = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
      setQuality(null)
    }
  }

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsFlipped(false)
      setQuality(null)
    }
  }

  if (!currentCard) {
    return <div>No flashcards available</div>
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            Card {currentIndex + 1} of {flashcards.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Flashcard */}
      <div className="relative">
        <div
          className="flashcard-container"
          onClick={() => !quality && setIsFlipped(!isFlipped)}
        >
          <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
            {/* Front of card */}
            <Card className="flashcard-front">
              <CardContent className="flex min-h-[400px] items-center justify-center p-8">
                <div className="text-center">
                  <p className="mb-4 text-sm font-medium text-gray-500">
                    Question
                  </p>
                  <p className="text-2xl">{currentCard.front}</p>
                </div>
              </CardContent>
            </Card>

            {/* Back of card */}
            <Card className="flashcard-back">
              <CardContent className="flex min-h-[400px] items-center justify-center p-8">
                <div className="text-center">
                  <p className="mb-4 text-sm font-medium text-gray-500">
                    Answer
                  </p>
                  <p className="text-2xl">{currentCard.back}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {!isFlipped && (
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setIsFlipped(true)
              }}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Flip
            </Button>
          </div>
        )}
      </div>

      {/* Navigation & Quality Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevCard}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        {isFlipped && !quality && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleQuality(0)}
              className="bg-red-50 text-red-700 hover:bg-red-100"
            >
              Again
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuality(1)}
              className="bg-orange-50 text-orange-700 hover:bg-orange-100"
            >
              Hard
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuality(2)}
              className="bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              Good
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuality(3)}
              className="bg-green-50 text-green-700 hover:bg-green-100"
            >
              Easy
            </Button>
          </div>
        )}

        <Button
          variant="outline"
          onClick={nextCard}
          disabled={currentIndex === flashcards.length - 1}
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

