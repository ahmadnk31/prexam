'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, X, File } from 'lucide-react'
import Link from 'next/link'

export default function DocumentUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
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
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/epub+zip': ['.epub'],
    },
    maxFiles: 1,
    disabled: uploading
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      alert('Please select a file')
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (title) {
        formData.append('title', title)
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const { documentId } = await response.json()
      router.push(`/dashboard/documents/${documentId}`)
    } catch (error: any) {
      alert(error.message || 'Upload failed')
      setUploading(false)
    }
  }

  const getFileType = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'PDF'
    if (ext === 'docx') return 'Word'
    if (ext === 'epub') return 'EPUB'
    return 'Document'
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-10">
        <h1 className="text-5xl font-bold text-[#4B3F72] mb-3">Upload Document</h1>
        <p className="text-lg text-purple-700/70 font-medium">
          Upload PDF, Word, or EPUB documents to create study materials
        </p>
      </div>

      <Card className="shadow-xl bg-white border-purple-100/50">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-[#4B3F72]">Upload Document</CardTitle>
          <CardDescription className="text-base text-purple-700/70 font-medium">
            Upload a PDF, Word (.docx), or EPUB file. We'll extract the text and generate study materials automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-[#4B3F72] font-semibold">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
                required
                className="border-purple-200 focus:border-[#4B3F72] focus:ring-[#4B3F72]"
              />
            </div>

            <div className="space-y-2">
              <Label>Document File</Label>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                  ${isDragActive
                    ? 'border-[#4B3F72] bg-purple-50'
                    : 'border-purple-200 hover:border-purple-300 hover:bg-purple-50/50'
                  }
                  ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-[#4B3F72]" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-[#4B3F72]">{file.name}</p>
                        <p className="text-xs text-purple-600/70">
                          {getFileType(file.name)} • {(file.size / 1024 / 1024).toFixed(2)} MB
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
                    <p className="text-xs text-purple-600/70 mt-2">
                      Click or drag to replace file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-purple-400" />
                    {isDragActive ? (
                      <p className="text-lg font-medium text-[#4B3F72]">
                        Drop the document file here...
                      </p>
                    ) : (
                      <>
                        <p className="text-lg font-medium text-purple-700">
                          Drag & drop a document file here
                        </p>
                        <p className="text-sm text-purple-600/70">
                          or click to browse
                        </p>
                        <p className="text-xs text-purple-500/70 mt-2">
                          Supports: PDF, Word (.docx), EPUB
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-purple-700/70 font-medium">Uploading and processing...</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all"
              size="lg"
              disabled={uploading || !file}
            >
              {uploading ? (
                <>
                  <Upload className="mr-2 h-5 w-5 animate-pulse" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Upload & Process Document
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

