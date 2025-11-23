import { openai } from './openai'

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'fill_blank'

export interface Question {
  type: QuestionType
  question: string
  options?: string[] // For MCQ
  correct_answer: string
  explanation?: string
}

/**
 * Generates questions from transcript segments using OpenAI
 */
export async function generateQuestions(
  transcriptSegments: string[],
  count: number = 20,
  language: string = 'en'
): Promise<Question[]> {
  const combinedTranscript = transcriptSegments.join('\n\n')

  const languageInstruction = language !== 'en' 
    ? `\n\nIMPORTANT: Respond in the same language as the transcript (language code: ${language}). All questions, options, answers, and explanations should be in that language.`
    : ''

  const prompt = `Create ${count} diverse educational questions from the following transcript.
Generate a mix of question types:
- Multiple Choice Questions (MCQ): 40%
- True/False: 20%
- Short Answer: 30%
- Fill in the Blank: 10%

For each question:
- type: one of "mcq", "true_false", "short_answer", "fill_blank"
- question: the question text
- options: array of options (only for MCQ, 4 options)
- correct_answer: the correct answer
- explanation: brief explanation (optional but recommended)

Format your response as a JSON array of objects.
Example:
[
  {
    "type": "mcq",
    "question": "What is X?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "explanation": "X is..."
  },
  {
    "type": "true_false",
    "question": "Y is always true.",
    "correct_answer": "False",
    "explanation": "Y can be false because..."
  }
]

Transcript:
${combinedTranscript}${languageInstruction}

Return ONLY the JSON array, no additional text.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            language !== 'en'
              ? `You are an educational assistant that creates high-quality questions from transcripts. Always respond in the same language as the transcript (language code: ${language}). Always return a valid JSON object with a "questions" array.`
              : 'You are an educational assistant that creates high-quality questions from transcripts. Always return a valid JSON object with a "questions" array.',
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

    // Try to parse as JSON object first, then as array
    let parsed: any
    try {
      parsed = JSON.parse(content)
      // If it's an object with a questions key, extract it
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions
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
    console.error('Error generating questions:', error)
    throw error
  }
}

