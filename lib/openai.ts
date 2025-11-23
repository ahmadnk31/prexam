import OpenAI from 'openai'

let openaiInstance: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiInstance = new OpenAI({
      apiKey,
    })
  }
  return openaiInstance
}

// Lazy initialization to avoid build-time errors
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return getOpenAI()[prop as keyof OpenAI]
  },
})

