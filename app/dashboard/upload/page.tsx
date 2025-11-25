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
      // For YouTube URLs, use the simple upload flow
      if (uploadMethod === 'youtube' && youtubeUrl) {
        const formData = new FormData()
        formData.append('youtubeUrl', youtubeUrl.trim())
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
        return
      }

      // For file uploads, use presigned URL for large files (always use for better reliability)
      if (uploadMethod === 'file' && file) {
        // Step 1: Create video record
        const createResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title || file.name,
            fileSize: file.size,
            fileName: file.name,
            // Signal that we'll use presigned URL
            usePresignedUrl: true,
          }),
        })

        if (!createResponse.ok) {
          const error = await createResponse.json()
          throw new Error(error.error || error.message || 'Failed to create video record')
        }

        const { videoId } = await createResponse.json()

        // Step 2: Get presigned URL
        const fileExt = file.name.split('.').pop() || 'mp4'
        const fileName = `${videoId}.${fileExt}`

        const presignedResponse = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoId,
            fileName,
            fileType: 'videos',
            contentType: file.type || 'video/mp4',
          }),
        })

        if (!presignedResponse.ok) {
          const error = await presignedResponse.json()
          throw new Error(error.error || error.message || 'Failed to get upload URL')
        }

        const { presignedUrl, key } = await presignedResponse.json()

        // Step 3: Upload directly to S3 using XMLHttpRequest (for progress tracking)
        console.log('Starting S3 upload:', {
          fileName: file.name,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          contentType: file.type,
        })

        try {
          // Upload to S3 using XMLHttpRequest to track upload progress
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100)
                setProgress(percentComplete)
                console.log(`Upload progress: ${percentComplete}%`)
              }
            })

            // Handle completion
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                console.log('S3 upload successful, finalizing...')
                setProgress(100)
                resolve()
              } else {
                let errorText = ''
                try {
                  errorText = xhr.responseText || xhr.statusText
                } catch (e) {
                  errorText = xhr.statusText || 'Unknown error'
                }
                
                console.error('S3 upload failed:', {
                  status: xhr.status,
                  statusText: xhr.statusText,
                  response: errorText.substring(0, 500),
                  presignedUrlPreview: presignedUrl.substring(0, 200) + '...',
                })
                
                // Provide helpful error message based on status code
                if (xhr.status === 400) {
                  const errorDetails = errorText.includes('CORS') 
                    ? 'CORS is not configured on your S3 bucket. See TROUBLESHOOTING_UPLOAD.md'
                    : errorText.includes('ACL') 
                    ? 'ACLs are disabled but required. Enable ACLs or update bucket policy. See TROUBLESHOOTING_UPLOAD.md'
                    : 'S3 rejected the request. Check: 1) CORS configuration, 2) Bucket policy allows PUT, 3) Object ownership settings. See TROUBLESHOOTING_UPLOAD.md'
                  
                  reject(new Error(`Upload failed (400): ${errorDetails}\n\nS3 Response: ${errorText.substring(0, 300)}`))
                } else if (xhr.status === 403) {
                  reject(new Error('S3 access denied (403). Check:\n1. Your AWS credentials are correct\n2. IAM user has s3:PutObject permission\n3. Bucket policy allows PUT requests\n\nSee TROUBLESHOOTING_UPLOAD.md'))
                } else if (xhr.status === 0) {
                  reject(new Error('Network error. This usually means:\n1. CORS is not configured (most common)\n2. Network connectivity issue\n3. Browser blocked the request\n\nSee TROUBLESHOOTING_UPLOAD.md for CORS setup'))
                } else {
                  reject(new Error(`Upload failed with status ${xhr.status}: ${errorText.substring(0, 200)}`))
                }
              }
            })

            // Handle errors
            xhr.addEventListener('error', () => {
              reject(new Error('Network error during upload. Please check your connection and CORS configuration.'))
            })

            xhr.addEventListener('abort', () => {
              reject(new Error('Upload was cancelled'))
            })

            // Start the upload
            xhr.open('PUT', presignedUrl)
            xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
            // Don't set any other headers - presigned URL handles auth
            xhr.send(file)
          })

          // Step 4: Finalize upload
          const finalizeResponse = await fetch('/api/upload/finalize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoId,
              s3Key: key,
            }),
          })

          if (!finalizeResponse.ok) {
            const error = await finalizeResponse.json()
            throw new Error(error.error || error.message || 'Failed to finalize upload')
          }

          router.push(`/dashboard/videos/${videoId}`)
        } catch (error: any) {
          console.error('Upload error:', error)
          
          // Provide more helpful error messages
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            throw new Error('Network error. Please check:\n1. Your internet connection\n2. CORS is configured on your S3 bucket (see AWS_SETUP.md)\n3. The bucket allows PUT requests from your domain')
          }
          
          throw error
        }
      }
    } catch (error: any) {
      alert(error.message || 'Upload failed. Please try again.')
      setUploading(false)
      setProgress(0)
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
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-700">Uploading...</p>
                  <p className="text-sm font-semibold text-[#4B3F72]">{progress}%</p>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-gray-500">
                  {file && progress > 0 && progress < 100
                    ? `${((file.size * progress) / 100 / 1024 / 1024).toFixed(2)} MB of ${(file.size / 1024 / 1024).toFixed(2)} MB`
                    : progress === 100
                    ? 'Upload complete! Finalizing...'
                    : 'Preparing upload...'}
                </p>
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

