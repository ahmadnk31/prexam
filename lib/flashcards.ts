import { openai } from './openai'

export interface Flashcard {
  front: string
  back: string
}

/**
 * Generates flashcards from transcript segments using OpenAI
 */
export async function generateFlashcards(
  transcriptSegments: string[]
): Promise<Flashcard[]> {
  const combinedTranscript = transcriptSegments.join('\n\n')

  const prompt = `Create educational flashcards from the following transcript. 
Generate 15-25 high-quality flashcards that cover key concepts, definitions, facts, and important information.

For each flashcard:
- Front: A clear question or prompt
- Back: A concise, accurate answer

Format your response as a JSON array of objects with "front" and "back" properties.
Example:
[
  {"front": "What is X?", "back": "X is..."},
  {"front": "Define Y", "back": "Y is..."}
]

Transcript:
${combinedTranscript}

Return ONLY the JSON array, no additional text.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an educational assistant that creates high-quality flashcards from transcripts. Always return a valid JSON object with a "flashcards" array.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Try to parse as JSON object first (if wrapped), then as array
    let parsed: any
    try {
      parsed = JSON.parse(content)
      // If it's an object with a flashcards key, extract it
      if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
        return parsed.flashcards
      }
      // If it's directly an array
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      // Try to extract JSON array from text
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
        return Array.isArray(parsed) ? parsed : []
      }
      throw new Error('Invalid JSON response')
    }

    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Error generating flashcards:', error)
    throw error
  }
}

/**
 * Updates flashcard SRS (Spaced Repetition System) data
 */
export function updateFlashcardSRS(
  easeFactor: number,
  interval: number,
  repetitions: number,
  quality: number // 0-5: Again=0, Hard=1, Good=2, Easy=3
): {
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewDate: Date
} {
  // Simplified SM-2 algorithm
  let newEaseFactor = easeFactor
  let newInterval = interval
  let newRepetitions = repetitions

  if (quality < 2) {
    // Again or Hard - reset
    newRepetitions = 0
    newInterval = 1
  } else {
    // Good or Easy
    newEaseFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02))
    )

    if (newRepetitions === 0) {
      newInterval = 1
    } else if (newRepetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(newInterval * newEaseFactor)
    }

    newRepetitions += 1
  }

  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate,
  }
}

