'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, Square, Loader2, Volume2, Headphones } from 'lucide-react'

type TranscriptionMode = 'interview' | 'meeting' | 'lecture' | 'podcast' | 'quick-notes' | 'general'

interface RealtimeAudioRecorderProps {
  onTranscriptionComplete: (fullTranscript: string, videoId: string) => void
  disabled?: boolean
  audioSource: 'microphone' | 'system'
  transcriptionMode?: TranscriptionMode
}

export default function RealtimeAudioRecorder({
  onTranscriptionComplete,
  disabled,
  audioSource,
  transcriptionMode = 'general',
}: RealtimeAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [transcript, setTranscript] = useState<string>('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const lastTranscriptionTimeRef = useRef<number>(0)
  const recordingMimeTypeRef = useRef<string>('audio/webm')

  useEffect(() => {
    // Check for microphone permission
    if (audioSource === 'microphone') {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => {
          setHasPermission(true)
        })
        .catch(() => {
          setHasPermission(false)
        })
    } else {
      // For system audio, check if getDisplayMedia is available
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        setHasPermission(true)
      } else {
        setHasPermission(false)
      }
    }

    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current)
      }
    }
  }, [audioSource])

  const convertBlobToWav = async (blob: Blob): Promise<Blob> => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Decode the audio blob
      const arrayBuffer = await blob.arrayBuffer()
      
      // Check if blob is large enough to be valid
      if (arrayBuffer.byteLength < 100) {
        throw new Error('Blob too small to decode')
      }
      
      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      } catch (decodeError) {
        // If decode fails, the webm chunk might be incomplete
        // Try to create a minimal valid webm or return error
        console.error('Failed to decode audio data:', decodeError)
        throw new Error('Invalid audio data - chunk may be incomplete')
      }
      
      // Convert to WAV
      const wav = audioBufferToWav(audioBuffer)
      const wavBlob = new Blob([wav], { type: 'audio/wav' })
      
      console.log('Converted to WAV:', {
        originalSize: blob.size,
        wavSize: wavBlob.size,
        duration: audioBuffer.duration
      })
      
      return wavBlob
    } catch (error) {
      console.error('Error converting to WAV:', error)
      // Don't fallback - throw error so we can skip this chunk
      throw error
    }
  }

  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length
    const numberOfChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const bytesPerSample = 2
    const blockAlign = numberOfChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = length * blockAlign
    const bufferSize = 44 + dataSize
    const arrayBuffer = new ArrayBuffer(bufferSize)
    const view = new DataView(arrayBuffer)

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, bufferSize - 8, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // fmt chunk size
    view.setUint16(20, 1, true) // audio format (PCM)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true) // bits per sample
    writeString(36, 'data')
    view.setUint32(40, dataSize, true)

    // Convert audio data
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }

    return arrayBuffer
  }

  const transcribeChunk = useCallback(async (audioBlob: Blob) => {
    if (isTranscribing) return

    setIsTranscribing(true)
    try {
      // Convert webm/blob to WAV for better compatibility with OpenAI
      // WAV is a simpler format that doesn't have fragmentation issues
      let processedBlob = audioBlob
      if (audioBlob.type.includes('webm') || audioBlob.type.includes('ogg') || audioBlob.type.includes('mp4')) {
        try {
          processedBlob = await convertBlobToWav(audioBlob)
          console.log('Successfully converted to WAV')
        } catch (conversionError: any) {
          console.error('WAV conversion failed:', conversionError)
          // If conversion fails, skip this chunk (it's likely incomplete)
          setIsTranscribing(false)
          return
        }
      }
      
      // Create File with proper extension
      const extension = processedBlob.type.includes('wav') ? 'wav' : 'webm'
      const audioFile = new File([processedBlob], `chunk.${extension}`, { 
        type: processedBlob.type || 'audio/wav'
      })
      
      const formData = new FormData()
      formData.append('audio', audioFile)
      formData.append('source', audioSource)
      formData.append('mode', transcriptionMode)
      formData.append('realtime', 'true')
      if (videoId) {
        formData.append('videoId', videoId)
      }

      const response = await fetch('/api/transcribe/audio/realtime', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Transcription failed')
      }

      const data = await response.json()
      
      if (data.videoId && !videoId) {
        setVideoId(data.videoId)
      }

      if (data.transcript) {
        setTranscript((prev) => {
          const newTranscript = prev ? `${prev} ${data.transcript}` : data.transcript
          return newTranscript
        })
      }
    } catch (error) {
      console.error('Error transcribing chunk:', error)
    } finally {
      setIsTranscribing(false)
    }
  }, [audioSource, videoId, isTranscribing])

  const startRecording = async () => {
    try {
      let stream: MediaStream

      if (audioSource === 'microphone') {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        })
      } else {
        // System audio capture using Screen Capture API
        try {
          // Request screen capture with audio
          // Note: Some browsers require video track even for audio-only capture
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Required by most browsers even for audio-only
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              suppressLocalAudioPlayback: false,
            } as MediaTrackConstraints,
          })

          // Check if audio track is available
          const audioTracks = displayStream.getAudioTracks()
          if (audioTracks.length === 0) {
            // User didn't select "Share audio" in the browser prompt
            // Stop video track and show helpful message
            displayStream.getVideoTracks().forEach(track => track.stop())
            alert('No audio track detected. Please make sure to check "Share audio" or "Share system audio" in the browser prompt when selecting what to share.')
            setHasPermission(false)
            return
          }

          // Create a new stream with only audio tracks for recording
          // This way we don't record unnecessary video
          const audioOnlyStream = new MediaStream(audioTracks)
          stream = audioOnlyStream

          // Stop video tracks immediately since we only need audio
          displayStream.getVideoTracks().forEach(track => track.stop())

          // Handle user stopping the screen share via audio track
          audioTracks.forEach(track => {
            track.onended = () => {
              if (isRecording) {
                stopRecording()
              }
            }
          })
        } catch (displayError: any) {
          console.error('Error capturing system audio:', displayError)
          
          // Provide helpful error messages
          if (displayError.name === 'NotAllowedError') {
            alert('System audio capture was denied. Please allow screen/audio sharing when prompted.')
          } else if (displayError.name === 'NotSupportedError') {
            alert('System audio capture is not supported in this browser. Please use Chrome, Edge, or Firefox (latest versions).')
          } else {
            alert(`Failed to capture system audio: ${displayError.message || 'Unknown error'}. Please try again or use microphone recording.`)
          }
          setHasPermission(false)
          return
        }
      }

      streamRef.current = stream

      // Determine the best supported mimeType
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      })
      mediaRecorderRef.current = mediaRecorder
      recordingMimeTypeRef.current = mimeType
      audioChunksRef.current = []

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Final transcription of remaining audio
        if (audioChunksRef.current.length > 0) {
          const finalBlob = new Blob(audioChunksRef.current, { 
            type: recordingMimeTypeRef.current 
          })
          await transcribeChunk(finalBlob)
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }

        // Wait a bit for final transcription to complete
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Finalize video with complete transcript
        if (videoId && transcript) {
          try {
            const response = await fetch('/api/transcribe/audio/finalize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                videoId,
                transcript,
                source: audioSource,
              }),
            })

            if (response.ok) {
              onTranscriptionComplete(transcript, videoId)
            }
          } catch (error) {
            console.error('Error finalizing transcript:', error)
            // Still navigate even if finalization fails
            if (videoId) {
              onTranscriptionComplete(transcript, videoId)
            }
          }
        }
      }

      // Start recording (continuous - we'll process chunks periodically)
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      setTranscript('')
      setVideoId(null)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      // Process accumulated chunks periodically (every 10 seconds)
      transcriptionIntervalRef.current = setInterval(async () => {
        if (!isRecording || isTranscribing || audioChunksRef.current.length === 0) return
        
        // Create a blob from accumulated chunks
        const chunkBlob = new Blob(audioChunksRef.current, { 
          type: recordingMimeTypeRef.current
        })
        
        // Only transcribe if we have enough audio (at least 10KB)
        if (chunkBlob.size >= 10240) {
          // Keep a copy for transcription
          const chunksToTranscribe = [...audioChunksRef.current]
          // Clear chunks after copying
          audioChunksRef.current = []
          
          // Transcribe the accumulated chunks
          await transcribeChunk(new Blob(chunksToTranscribe, { 
            type: recordingMimeTypeRef.current 
          }))
        }
      }, 10000) // Process every 10 seconds

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
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current)
        transcriptionIntervalRef.current = null
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  if (hasPermission === false && audioSource === 'microphone') {
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
            {audioSource === 'microphone' ? (
              <Mic className="h-5 w-5" />
            ) : (
              <Headphones className="h-5 w-5" />
            )}
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
          <p className="text-sm text-gray-600">
            Recording in progress... {isTranscribing && '(Transcribing...)'}
          </p>
        </div>
      )}

      {transcript && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Live Transcript</h3>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{transcript.split(' ').filter(w => w.length > 0).length} words</span>
                <span>{transcript.length} characters</span>
              </div>
            </div>
            <ScrollArea className="h-[500px] rounded-lg border p-4 bg-gray-50">
              <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
                {transcript}
              </p>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {hasPermission === null && (
        <p className="text-sm text-gray-500 text-center">Checking permissions...</p>
      )}
    </div>
  )
}

