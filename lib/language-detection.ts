import { openai } from './openai'

/**
 * Detects the language of the given text using OpenAI
 * Returns ISO 639-1 language code (e.g., 'en', 'nl', 'de', 'fr', 'es')
 */
export async function detectLanguage(text: string): Promise<string> {
  // Take a sample of the text (first 1000 characters) for efficiency
  const sample = text.slice(0, 1000).trim()
  
  if (!sample || sample.length < 10) {
    return 'en' // Default to English if text is too short
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a language detection assistant. Identify the primary language of the given text and respond with only the ISO 639-1 language code (e.g., "en" for English, "nl" for Dutch, "de" for German, "fr" for French, "es" for Spanish). If the language is unclear or mixed, respond with the most dominant language code.',
        },
        {
          role: 'user',
          content: `What is the language of this text? Respond with only the ISO 639-1 language code:\n\n${sample}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 10,
    })

    const detectedLanguage = response.choices[0]?.message?.content?.trim().toLowerCase() || 'en'
    
    // Validate it's a reasonable language code (2-3 characters, alphabetic)
    if (/^[a-z]{2,3}$/.test(detectedLanguage)) {
      return detectedLanguage
    }
    
    return 'en' // Default to English if response is invalid
  } catch (error) {
    console.error('Error detecting language:', error)
    return 'en' // Default to English on error
  }
}

/**
 * Gets the language name from ISO 639-1 code for display purposes
 */
export function getLanguageName(code: string): string {
  const languageNames: Record<string, string> = {
    en: 'English',
    nl: 'Dutch',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    ja: 'Japanese',
    zh: 'Chinese',
    ko: 'Korean',
    ar: 'Arabic',
    hi: 'Hindi',
    sv: 'Swedish',
    da: 'Danish',
    no: 'Norwegian',
    fi: 'Finnish',
    pl: 'Polish',
    tr: 'Turkish',
    cs: 'Czech',
    hu: 'Hungarian',
    ro: 'Romanian',
    el: 'Greek',
    he: 'Hebrew',
    th: 'Thai',
    vi: 'Vietnamese',
  }
  
  return languageNames[code] || code.toUpperCase()
}

