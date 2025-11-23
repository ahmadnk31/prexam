'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, Loader2 } from 'lucide-react'

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  disabled?: boolean
}

export default function AudioRecorder({ onRecordingComplete, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check for microphone permission
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        setHasPermission(true)
      })
      .catch(() => {
        setHasPermission(false)
      })

    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        onRecordingComplete(audioBlob)
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Failed to start recording. Please check microphone permissions.')
      setHasPermission(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  if (hasPermission === false) {
    return (
      <div className="text-center p-4 border border-red-200 rounded-lg bg-red-50">
        <p className="text-sm text-red-700 mb-2">
          Microphone permission denied. Please enable microphone access in your browser settings.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setHasPermission(null)
            navigator.mediaDevices
              .getUserMedia({ audio: true })
              .then(() => setHasPermission(true))
              .catch(() => setHasPermission(false))
          }}
        >
          Request Permission
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          <Button
            type="button"
            onClick={startRecording}
            disabled={disabled || hasPermission === null}
            className="flex items-center gap-2"
            size="lg"
          >
            <Mic className="h-5 w-5" />
            Start Recording
          </Button>
        ) : (
          <Button
            type="button"
            onClick={stopRecording}
            variant="destructive"
            className="flex items-center gap-2"
            size="lg"
          >
            <Square className="h-5 w-5" />
            Stop Recording
          </Button>
        )}
      </div>

      {isRecording && (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            <p className="text-lg font-mono font-semibold text-red-600">
              {formatTime(recordingTime)}
            </p>
          </div>
          <p className="text-sm text-gray-600">Recording in progress...</p>
        </div>
      )}

      {hasPermission === null && (
        <p className="text-sm text-gray-500 text-center">Checking microphone permission...</p>
      )}
    </div>
  )
}

