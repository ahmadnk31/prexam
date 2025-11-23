'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClient } from '@/supabase/client'

interface Question {
  id: string
  type: 'mcq' | 'true_false' | 'short_answer' | 'fill_blank'
  question: string
  options?: string[] | null
  correct_answer: string
  explanation?: string | null
}

interface QuizComponentProps {
  questions: Question[]
  videoId: string
}

export default function QuizComponent({
  questions,
  videoId,
}: QuizComponentProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    if (!submitted) {
      const interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [submitted, startTime])

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const progress = ((currentIndex + 1) / questions.length) * 100

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: value })
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = async () => {
    let correct = 0
    questions.forEach((q) => {
      const userAnswer = answers[q.id]?.trim().toLowerCase()
      const correctAnswer = q.correct_answer.trim().toLowerCase()
      if (userAnswer === correctAnswer) {
        correct++
      }
    })

    const finalScore = Math.round((correct / questions.length) * 100)
    setScore(finalScore)
    setSubmitted(true)

    // Save quiz attempt
    const supabase = createClient()
    await supabase.from('quiz_attempts').insert({
      video_id: videoId,
      score: correct,
      total_questions: questions.length,
      time_taken: timeElapsed,
      answers,
    })
  }

  if (submitted && score !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quiz Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="mb-4 text-6xl font-bold text-blue-600">
              {score}%
            </div>
            <p className="text-lg text-gray-600">
              You got {Object.values(answers).filter((ans, idx) => {
                const q = questions[idx]
                return ans?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
              }).length} out of {questions.length} questions correct
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Time taken: {Math.floor(timeElapsed / 60)}:
              {String(timeElapsed % 60).padStart(2, '0')}
            </p>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id]
              const isCorrect =
                userAnswer?.trim().toLowerCase() ===
                q.correct_answer.trim().toLowerCase()

              return (
                <div
                  key={q.id}
                  className={`rounded-lg border p-4 ${
                    isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="mb-2 font-medium">
                    {idx + 1}. {q.question}
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Your answer:</span>{' '}
                      {userAnswer || 'No answer'}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Correct answer:</span>{' '}
                      {q.correct_answer}
                    </p>
                    {q.explanation && (
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Explanation:</span>{' '}
                        {q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Button
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Retake Quiz
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span>{Math.floor(timeElapsed / 60)}:{String(timeElapsed % 60).padStart(2, '0')}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <Card>
        <CardHeader>
          <CardTitle>{currentQuestion.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentQuestion.type === 'mcq' && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id] || ''}
              onValueChange={handleAnswer}
            >
              {currentQuestion.options.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${idx}`} />
                  <Label htmlFor={`option-${idx}`} className="cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.type === 'true_false' && (
            <RadioGroup
              value={answers[currentQuestion.id] || ''}
              onValueChange={handleAnswer}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="True" id="true" />
                <Label htmlFor="true" className="cursor-pointer">
                  True
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="False" id="false" />
                <Label htmlFor="false" className="cursor-pointer">
                  False
                </Label>
              </div>
            </RadioGroup>
          )}

          {(currentQuestion.type === 'short_answer' ||
            currentQuestion.type === 'fill_blank') && (
            <Input
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Enter your answer"
            />
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              Previous
            </Button>

            {isLastQuestion ? (
              <Button onClick={handleSubmit}>Submit Quiz</Button>
            ) : (
              <Button onClick={handleNext}>Next</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

