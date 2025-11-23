'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Upload, Youtube, FileVideo, X, Mic } from 'lucide-react'
import Link from 'next/link'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [title, setTitle] = useState('')
  const [uploadMethod, setUploadMethod] = useState<'file' | 'youtube'>('file')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles[0]) {
      const selectedFile = acceptedFiles[0]
      setFile(selectedFile)
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }, [title])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv']
    },
    maxFiles: 1,
    disabled: uploadMethod !== 'file' || uploading
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      if (!title) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^https?:\/\/(www\.)?(m\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
    ]
    return patterns.some(pattern => pattern.test(url))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate YouTube URL if that's the method
    if (uploadMethod === 'youtube' && youtubeUrl) {
      if (!validateYouTubeUrl(youtubeUrl)) {
        alert('Please enter a valid YouTube URL. Supported formats:\n- https://www.youtube.com/watch?v=VIDEO_ID\n- https://youtu.be/VIDEO_ID\n- https://www.youtube.com/embed/VIDEO_ID')
        return
      }
    }

    setUploading(true)
    setProgress(0)

    try {
      // Handle file upload or YouTube URL
      const formData = new FormData()
      if (uploadMethod === 'file' && file) {
        formData.append('file', file)
      } else if (uploadMethod === 'youtube' && youtubeUrl) {
        formData.append('youtubeUrl', youtubeUrl.trim())
      }
      if (title) {
        formData.append('title', title)
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Upload failed')
      }

      const { videoId } = await response.json()
      router.push(`/dashboard/videos/${videoId}`)
    } catch (error: any) {
      alert(error.message || 'Upload failed. Please try again.')
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-10">
        <h1 className="text-5xl font-bold text-[#4B3F72] mb-3">Upload Video</h1>
        <p className="text-lg text-purple-700/70 font-medium">
          Add a new video to your library and start studying
        </p>
      </div>

      <Card className="shadow-xl bg-white border-purple-100/50">
        <CardHeader>
          <CardTitle className="text-2xl">Choose Upload Method</CardTitle>
          <CardDescription className="text-base">
            Upload a video file or paste a YouTube URL. We'll automatically transcribe and generate study materials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <Button
              type="button"
              variant={uploadMethod === 'file' ? 'default' : 'outline'}
              onClick={() => setUploadMethod('file')}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload File
            </Button>
            <Button
              type="button"
              variant={uploadMethod === 'youtube' ? 'default' : 'outline'}
              onClick={() => setUploadMethod('youtube')}
              className="flex-1"
            >
              <Youtube className="mr-2 h-4 w-4" />
              YouTube URL
            </Button>
            <Link href="/dashboard/transcribe" className="flex-1">
              <Button
                type="button"
                variant="outline"
                className="w-full"
              >
                <Mic className="mr-2 h-4 w-4" />
                Record Audio
              </Button>
            </Link>
          </div>
          
          <div className="mb-6 p-5 bg-gradient-to-br from-purple-50 to-yellow-50 border border-purple-200 rounded-xl">
            <p className="text-sm font-bold text-[#4B3F72] mb-2">
              💡 <strong>Need to record audio?</strong>
            </p>
            <p className="text-sm text-purple-700/80 font-medium">
              Use our dedicated transcription page to record from your microphone or capture system audio with real-time transcription and plenty of space to view your transcript.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                required
              />
            </div>

            {uploadMethod === 'file' ? (
              <div className="space-y-2">
                <Label>Video File</Label>
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }
                    ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <input {...getInputProps()} />
                  {file ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <FileVideo className="h-8 w-8 text-blue-600" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFile(null)
                          }}
                          disabled={uploading}
                          className="ml-2 h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Click or drag to replace file
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 mx-auto text-gray-400" />
                      {isDragActive ? (
                        <p className="text-lg font-medium text-blue-600">
                          Drop the video file here...
                        </p>
                      ) : (
                        <>
                          <p className="text-lg font-medium text-gray-700">
                            Drag & drop a video file here
                          </p>
                          <p className="text-sm text-gray-500">
                            or click to browse
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            Supports: MP4, MOV, AVI, MKV, WebM, and more
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="youtubeUrl">YouTube URL</Label>
                <Input
                  id="youtubeUrl"
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required={uploadMethod === 'youtube'}
                />
                <p className="text-xs text-gray-500">
                  Paste any YouTube video URL to get started
                </p>
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <p className="text-blue-800 font-medium mb-1">💡 Important:</p>
                  <p className="text-blue-700">
                    For best results, use videos with captions/subtitles enabled. Videos without captions may not work due to YouTube's restrictions.
                  </p>
                </div>
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-gray-600">Uploading...</p>
              </div>
            )}

            {(uploadMethod === 'file' || uploadMethod === 'youtube') && (
              <Button 
                type="submit" 
                className="w-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all" 
                size="lg" 
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Upload className="mr-2 h-5 w-5 animate-pulse" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Upload & Start Processing
                  </>
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

