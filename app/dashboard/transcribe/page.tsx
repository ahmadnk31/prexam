'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, Headphones, ArrowLeft, Users, GraduationCap, Radio, FileText, MessageSquare } from 'lucide-react'
import RealtimeAudioRecorder from '@/components/realtime-audio-recorder'
import Link from 'next/link'

export type TranscriptionMode = 'interview' | 'meeting' | 'lecture' | 'podcast' | 'quick-notes' | 'general'

const transcriptionModes: {
  id: TranscriptionMode
  name: string
  description: string
  icon: React.ReactNode
  color: string
}[] = [
  {
    id: 'interview',
    name: 'Interview Mode',
    description: 'Optimized for one-on-one conversations with clear speaker turns',
    icon: <MessageSquare className="h-5 w-5" />,
    color: 'blue'
  },
  {
    id: 'meeting',
    name: 'Meeting Mode',
    description: 'Best for multiple speakers, team meetings, and group discussions',
    icon: <Users className="h-5 w-5" />,
    color: 'green'
  },
  {
    id: 'lecture',
    name: 'Lecture Mode',
    description: 'Perfect for educational content, presentations, and long-form speeches',
    icon: <GraduationCap className="h-5 w-5" />,
    color: 'purple'
  },
  {
    id: 'podcast',
    name: 'Podcast Mode',
    description: 'Ideal for podcasts, long conversations, and extended recordings',
    icon: <Radio className="h-5 w-5" />,
    color: 'orange'
  },
  {
    id: 'quick-notes',
    name: 'Quick Notes',
    description: 'Fast transcription for brief recordings and voice memos',
    icon: <FileText className="h-5 w-5" />,
    color: 'yellow'
  },
  {
    id: 'general',
    name: 'General',
    description: 'Default mode for any type of audio content',
    icon: <Mic className="h-5 w-5" />,
    color: 'gray'
  }
]

export default function TranscribePage() {
  const [audioSource, setAudioSource] = useState<'microphone' | 'system'>('microphone')
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>('general')
  const router = useRouter()

  const handleTranscriptionComplete = (fullTranscript: string, videoId: string) => {
    router.push(`/dashboard/videos/${videoId}`)
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <Link href="/dashboard/upload">
          <Button variant="ghost" className="mb-6 text-[#4B3F72] hover:bg-purple-50 font-medium">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Upload
          </Button>
        </Link>
        <h1 className="text-5xl font-bold text-[#4B3F72] mb-3">Audio Transcription</h1>
        <p className="text-lg text-purple-700/70 font-medium">
          Record audio and get real-time transcription with AI-powered study materials
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card 
          className={`cursor-pointer transition-all bg-white border-2 ${
            audioSource === 'microphone' 
              ? 'ring-2 ring-[#4B3F72] border-[#4B3F72] shadow-lg' 
              : 'border-purple-200 hover:border-purple-300 hover:shadow-md'
          }`}
          onClick={() => setAudioSource('microphone')}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg transition-colors ${
                audioSource === 'microphone' 
                  ? 'bg-purple-100 text-[#4B3F72]' 
                  : 'bg-purple-50 text-purple-600'
              }`}>
                <Mic className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className={`text-lg font-bold ${audioSource === 'microphone' ? 'text-[#4B3F72]' : 'text-purple-700'}`}>Microphone</CardTitle>
                <CardDescription className="text-purple-600/70">Record from your microphone</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-700/70 font-medium">
              Perfect for recording your voice, presentations, or any audio captured by your microphone.
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all bg-white border-2 ${
            audioSource === 'system' 
              ? 'ring-2 ring-[#4B3F72] border-[#4B3F72] shadow-lg' 
              : 'border-purple-200 hover:border-purple-300 hover:shadow-md'
          }`}
          onClick={() => setAudioSource('system')}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg transition-colors ${
                audioSource === 'system' 
                  ? 'bg-purple-100 text-[#4B3F72]' 
                  : 'bg-purple-50 text-purple-600'
              }`}>
                <Headphones className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className={`text-lg font-bold ${audioSource === 'system' ? 'text-[#4B3F72]' : 'text-purple-700'}`}>System Audio</CardTitle>
                <CardDescription className="text-purple-600/70">Record from your computer</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-700/70 font-medium">
              Capture audio from any tab, window, or application. Great for online lectures, meetings, or videos.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#4B3F72] mb-5">Transcription Mode</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {transcriptionModes.map((mode) => {
            const isSelected = transcriptionMode === mode.id
            const colorClasses = {
              blue: isSelected ? 'bg-blue-50 text-blue-700 border-blue-400 shadow-md' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300',
              green: isSelected ? 'bg-green-50 text-green-700 border-green-400 shadow-md' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300',
              purple: isSelected ? 'bg-purple-100 text-[#4B3F72] border-[#4B3F72] shadow-md' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300',
              orange: isSelected ? 'bg-orange-50 text-orange-700 border-orange-400 shadow-md' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300',
              yellow: isSelected ? 'bg-yellow-50 text-yellow-700 border-yellow-400 shadow-md' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300',
              gray: isSelected ? 'bg-purple-50 text-[#4B3F72] border-[#4B3F72] shadow-md' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300',
            }
            
            return (
              <Card
                key={mode.id}
                className={`cursor-pointer transition-all border-2 bg-white ${
                  isSelected ? 'ring-2 ring-offset-2 ring-[#4B3F72]/20' : ''
                } ${colorClasses[mode.color as keyof typeof colorClasses]}`}
                onClick={() => setTranscriptionMode(mode.id)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`p-3 rounded-xl transition-colors ${
                      isSelected 
                        ? mode.color === 'blue' ? 'bg-blue-100' :
                          mode.color === 'green' ? 'bg-green-100' :
                          mode.color === 'purple' ? 'bg-purple-200' :
                          mode.color === 'orange' ? 'bg-orange-100' :
                          mode.color === 'yellow' ? 'bg-yellow-100' :
                          'bg-purple-100'
                        : 'bg-purple-50'
                    }`}>
                      {mode.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{mode.name}</p>
                      <p className="text-xs mt-1.5 opacity-80 font-medium">{mode.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <Card className="shadow-xl bg-white border-purple-100/50">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-[#4B3F72]">
            {audioSource === 'microphone' ? 'Microphone Recording' : 'System Audio Recording'}
          </CardTitle>
          <CardDescription className="text-base text-purple-700/70 font-medium">
            {audioSource === 'microphone' 
              ? 'Record audio from your microphone with real-time transcription. Click "Start Recording" to begin.'
              : 'Record system audio from any tab, window, or application with real-time transcription. You will be prompted to select what to share - make sure to check "Share audio" in the prompt.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[600px]">
            <RealtimeAudioRecorder
              audioSource={audioSource}
              transcriptionMode={transcriptionMode}
              onTranscriptionComplete={handleTranscriptionComplete}
            />
          </div>
          
          {audioSource === 'system' && (
            <div className="mt-6 p-5 bg-gradient-to-br from-purple-50 to-yellow-50 border border-purple-200 rounded-xl">
              <p className="text-sm font-bold text-[#4B3F72] mb-3">
                💡 System Audio Capture Tips:
              </p>
              <ul className="text-sm text-purple-700/80 list-disc list-inside space-y-1.5 font-medium">
                <li>Click "Start Recording" and select the tab/window/entire screen you want to capture</li>
                <li>Make sure to check "Share audio" or "Share system audio" in the browser prompt</li>
                <li>Works best in Chrome, Edge, or Firefox (latest versions)</li>
                <li>You can minimize the browser window - audio will continue recording</li>
                <li>To stop recording, click the stop button or stop sharing in your browser</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

