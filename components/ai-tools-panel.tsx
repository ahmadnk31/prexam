'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Brain, HelpCircle, BookOpen, RotateCw } from 'lucide-react'
import Link from 'next/link'
import NotesPanel from '@/components/notes-panel'
import SummaryPanel from '@/components/summary-panel'
import { useToast } from '@/components/ui/use-toast'

interface Flashcard {
  id: string
  front: string
  back: string
}

interface Question {
  id: string
  type: string
  question: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
}

interface AIToolsPanelProps {
  videoId: string
}

export default function AIToolsPanel({ videoId }: AIToolsPanelProps) {
  const { toast } = useToast()
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loadingFlashcards, setLoadingFlashcards] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [summaryContent, setSummaryContent] = useState<string | null>(null)

  const fetchFlashcards = async () => {
    setLoadingFlashcards(true)
    try {
      const response = await fetch(`/api/flashcards?videoId=${videoId}`)
      if (response.ok) {
        const data = await response.json()
        setFlashcards(data.flashcards || [])
      }
    } catch (error) {
      console.error('Error fetching flashcards:', error)
    } finally {
      setLoadingFlashcards(false)
    }
  }

  const fetchQuestions = async () => {
    setLoadingQuestions(true)
    try {
      const response = await fetch(`/api/questions?videoId=${videoId}`)
      if (response.ok) {
        const data = await response.json()
        setQuestions(data.questions || [])
      }
    } catch (error) {
      console.error('Error fetching questions:', error)
    } finally {
      setLoadingQuestions(false)
    }
  }

  const handleGenerateFlashcards = async (regenerate = false) => {
    setGeneratingFlashcards(true)
    try {
      const response = await fetch('/api/generate/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate flashcards')
      }

      const data = await response.json()
      await fetchFlashcards() // Refresh the list
    } catch (error) {
      alert('Failed to generate flashcards')
    } finally {
      setGeneratingFlashcards(false)
    }
  }

  const handleGenerateQuestions = async (regenerate = false) => {
    setGeneratingQuestions(true)
    try {
      const response = await fetch('/api/generate/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, count: 20 }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate questions')
      }

      const data = await response.json()
      await fetchQuestions() // Refresh the list
    } catch (error) {
      alert('Failed to generate questions')
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true)
    try {
      const response = await fetch('/api/generate/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate summary')
      }

      const data = await response.json()
      setSummaryContent(data.content)
      
      // Show success toast
      toast({
        variant: 'success',
        title: 'Summary generated!',
        description: 'Your video summary has been created successfully.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to generate summary',
        description: 'Please try again later.',
      })
    } finally {
      setGeneratingSummary(false)
    }
  }

  // Load existing data on mount
  useEffect(() => {
    fetchFlashcards()
    fetchQuestions()
    
    const loadSummary = async () => {
      try {
        const response = await fetch(`/api/summary?videoId=${videoId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.content) {
            setSummaryContent(data.content)
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }
    loadSummary()
  }, [videoId])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Tools
        </CardTitle>
        <CardDescription>
          Generate study materials from your video
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        <Tabs defaultValue="flashcards" className="w-full h-full flex flex-col">
          <TabsList className="w-full flex flex-nowrap overflow-x-auto scrollbar-hide h-auto p-1.5 bg-muted/50">
            <TabsTrigger 
              value="flashcards" 
              className="text-xs sm:text-sm py-2.5 px-4 sm:px-6 whitespace-nowrap flex-shrink-0 min-w-fit"
            >
              <span className="hidden sm:inline">Flashcards</span>
              <span className="sm:hidden">Cards</span>
            </TabsTrigger>
            <TabsTrigger 
              value="questions" 
              className="text-xs sm:text-sm py-2.5 px-4 sm:px-6 whitespace-nowrap flex-shrink-0 min-w-fit"
            >
              <span className="hidden sm:inline">Questions</span>
              <span className="sm:hidden">Quiz</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notes" 
              className="text-xs sm:text-sm py-2.5 px-4 sm:px-6 whitespace-nowrap flex-shrink-0 min-w-fit"
            >
              Notes
            </TabsTrigger>
            <TabsTrigger 
              value="summary" 
              className="text-xs sm:text-sm py-2.5 px-4 sm:px-6 whitespace-nowrap flex-shrink-0 min-w-fit"
            >
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flashcards" className="flex-1 min-h-0 flex flex-col space-y-4 overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col space-y-2 overflow-hidden">
              <div className="flex items-center justify-between flex-shrink-0">
                <p className="text-sm text-gray-600">
                  {flashcards.length > 0 
                    ? `${flashcards.length} flashcards generated`
                    : 'Generate flashcards to study key concepts from the video.'}
                </p>
                {flashcards.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateFlashcards(true)}
                    disabled={generatingFlashcards}
                  >
                    <RotateCw className={`mr-2 h-4 w-4 ${generatingFlashcards ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                )}
              </div>
              
              {loadingFlashcards ? (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : flashcards.length > 0 ? (
                <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
                  <ScrollArea className="flex-1 min-h-0 rounded-lg border p-4">
                    <div className="space-y-3">
                      {flashcards.map((flashcard, index) => (
                        <Card key={flashcard.id} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">
                                {flashcard.front}
                              </p>
                              <p className="text-xs text-gray-600">
                                {flashcard.back}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                  <Link href={`/dashboard/videos/${videoId}/flashcards`} className="flex-shrink-0">
                    <Button className="w-full">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Study Flashcards
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button
                  onClick={() => handleGenerateFlashcards(false)}
                  disabled={generatingFlashcards}
                  className="w-full"
                >
                  {generatingFlashcards ? (
                    <>
                      <Skeleton className="mr-2 h-4 w-4" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Generate Flashcards
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="questions" className="flex-1 min-h-0 flex flex-col space-y-4">
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <div className="flex items-center justify-between flex-shrink-0">
                <p className="text-sm text-gray-600">
                  {questions.length > 0 
                    ? `${questions.length} questions generated`
                    : 'Generate practice questions to test your understanding.'}
                </p>
                {questions.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateQuestions(true)}
                    disabled={generatingQuestions}
                  >
                    <RotateCw className={`mr-2 h-4 w-4 ${generatingQuestions ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                )}
              </div>
              
              {loadingQuestions ? (
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : questions.length > 0 ? (
                <div className="flex-1 min-h-0 flex flex-col space-y-3">
                  <ScrollArea className="flex-1 rounded-lg border p-4">
                    <div className="space-y-3">
                      {questions.map((question, index) => (
                        <Card key={question.id} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                {question.type}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                              {question.question}
                            </p>
                            {question.options && Array.isArray(question.options) && (
                              <div className="text-xs text-gray-600 space-y-1">
                                {question.options.map((option, optIndex) => (
                                  <div key={optIndex} className="pl-2">
                                    {String.fromCharCode(65 + optIndex)}. {option}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="pt-1 border-t">
                              <p className="text-xs text-green-700 font-medium">
                                Answer: {question.correct_answer}
                              </p>
                              {question.explanation && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {question.explanation}
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                  <Link href={`/dashboard/videos/${videoId}/quiz`} className="flex-shrink-0">
                    <Button className="w-full">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Take Quiz
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button
                  onClick={() => handleGenerateQuestions(false)}
                  disabled={generatingQuestions}
                  className="w-full"
                >
                  {generatingQuestions ? (
                    <>
                      <Skeleton className="mr-2 h-4 w-4" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Generate Questions
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 min-h-0 flex flex-col">
            <NotesPanel videoId={videoId} />
          </TabsContent>

          <TabsContent value="summary" className="flex-1 min-h-0 flex flex-col">
            <SummaryPanel
              videoId={videoId}
              content={summaryContent}
              generating={generatingSummary}
              onGenerate={handleGenerateSummary}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

