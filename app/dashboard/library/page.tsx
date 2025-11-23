import { createClient } from '@/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Video, 
  BookOpen, 
  HelpCircle,
  Share2,
  Play,
  Clock,
  FileText
} from 'lucide-react'
import ShareButton from '@/components/share-button'
import DeleteVideoButton from '@/components/delete-video-button'
import DeleteDocumentButton from '@/components/delete-document-button'

async function getVideos() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching videos:', error)
    return []
  }

  return data || []
}

async function getDocuments() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  return data || []
}

export default async function LibraryPage() {
  const videos = await getVideos()
  const documents = await getDocuments()

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 sm:mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#4B3F72] mb-2 sm:mb-3">My Library</h1>
          <p className="text-base sm:text-lg text-purple-700/70 font-medium">
            Your videos, flashcards, and study materials
          </p>
        </div>
        <Link href="/dashboard/upload" className="w-full sm:w-auto">
          <Button size="lg" className="w-full sm:w-auto gap-2 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all">
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Upload Video</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="videos" className="w-full">
        <TabsList className="mb-4 sm:mb-6 flex flex-nowrap justify-start w-auto overflow-x-auto scrollbar-hide h-auto p-1.5 bg-muted/50">
          <TabsTrigger value="videos" className="flex-shrink-0 min-w-fit whitespace-nowrap gap-1 sm:gap-2 text-xs sm:text-sm">
            <Video className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Videos</span>
            <span className="ml-1">({videos.length})</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-shrink-0 min-w-fit whitespace-nowrap gap-1 sm:gap-2 text-xs sm:text-sm">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Documents</span>
            <span className="ml-1">({documents.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos">
          {videos.length === 0 ? (
            <Card className="border-2 border-dashed border-purple-200 bg-white/80 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
                <div className="mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-purple-100 to-yellow-100 p-4 sm:p-6">
                  <Video className="h-12 w-12 sm:h-16 sm:w-16 text-[#4B3F72]" />
                </div>
                <h3 className="mb-2 sm:mb-3 text-xl sm:text-2xl font-bold text-[#4B3F72]">No videos yet</h3>
                <p className="mb-6 sm:mb-8 text-center text-purple-700/70 max-w-md text-sm sm:text-base font-medium">
                  Get started by uploading your first video or pasting a YouTube link. 
                  We'll automatically generate flashcards and questions for you.
                </p>
                <Link href="/dashboard/upload" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto gap-2 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all">
                    <Plus className="h-5 w-5" />
                    Upload Your First Video
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video: any) => (
            <Card key={video.id} className="group transition-all hover:shadow-xl hover:-translate-y-1 bg-white border-purple-100/50 shadow-md">
              <CardHeader className="pb-3 px-4 sm:px-6">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="line-clamp-2 text-base sm:text-lg font-bold text-[#4B3F72]">{video.title}</CardTitle>
                    <CardDescription className="mt-2 text-xs sm:text-sm text-purple-600/70 font-medium">
                      {new Date(video.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {video.status === 'ready' && (
                      <ShareButton videoId={video.id} videoTitle={video.title} />
                    )}
                    <DeleteVideoButton videoId={video.id} videoTitle={video.title} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold ${
                        video.status === 'ready'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : video.status === 'error'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                      }`}
                    >
                      {video.status === 'ready' && <Play className="h-3 w-3" />}
                      {video.status}
                    </span>
                    {video.duration && (
                      <span className="flex items-center gap-1 text-xs sm:text-sm text-gray-600">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                        {Math.floor(video.duration / 60)}:
                        {String(video.duration % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  
                  {video.status === 'ready' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link 
                        href={`/dashboard/videos/${video.id}`}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium text-xs sm:text-sm" size="sm">
                          <Video className="h-3 w-3 sm:h-4 sm:w-4" />
                          Watch
                        </Button>
                      </Link>
                      <Link 
                        href={`/dashboard/videos/${video.id}/flashcards`}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium text-xs sm:text-sm" size="sm">
                          <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                          Study
                        </Button>
                      </Link>
                      <Link 
                        href={`/dashboard/videos/${video.id}/quiz`}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium text-xs sm:text-sm" size="sm">
                          <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                          Quiz
                        </Button>
                      </Link>
                    </div>
                  )}
                  
                  {video.status !== 'ready' && (
                    <Link href={`/dashboard/videos/${video.id}`}>
                      <Button variant="outline" className="w-full text-xs sm:text-sm" size="sm">
                        View Details
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents">
          {documents.length === 0 ? (
            <Card className="border-2 border-dashed border-purple-200 bg-white/80 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
                <div className="mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-purple-100 to-yellow-100 p-4 sm:p-6">
                  <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-[#4B3F72]" />
                </div>
                <h3 className="mb-2 sm:mb-3 text-xl sm:text-2xl font-bold text-[#4B3F72]">No documents yet</h3>
                <p className="mb-6 sm:mb-8 text-center text-purple-700/70 max-w-md text-sm sm:text-base font-medium">
                  Upload PDF, Word, or EPUB documents to extract text and generate study materials.
                </p>
                <Link href="/dashboard/documents/upload" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto gap-2 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all">
                    <Plus className="h-5 w-5" />
                    Upload Your First Document
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((document: any) => (
                <Card key={document.id} className="group transition-all hover:shadow-xl hover:-translate-y-1 bg-white border-purple-100/50 shadow-md">
                  <CardHeader className="pb-3 px-4 sm:px-6">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="line-clamp-2 text-base sm:text-lg font-bold text-[#4B3F72]">{document.title}</CardTitle>
                        <CardDescription className="mt-2 text-xs sm:text-sm text-purple-600/70 font-medium">
                          {new Date(document.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-purple-600/70 font-medium uppercase">{document.file_type}</span>
                        <DeleteDocumentButton documentId={document.id} documentTitle={document.title} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold ${
                            document.status === 'ready'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : document.status === 'error'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          }`}
                        >
                          {document.status === 'ready' && <FileText className="h-3 w-3" />}
                          {document.status}
                        </span>
                        {document.page_count && (
                          <span className="text-xs sm:text-sm text-gray-600">
                            {document.page_count} {document.page_count === 1 ? 'page' : 'pages'}
                          </span>
                        )}
                      </div>
                      
                      {document.status === 'ready' && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Link 
                            href={`/dashboard/documents/${document.id}`}
                            className="flex-1"
                          >
                            <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium text-xs sm:text-sm" size="sm">
                              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                              View
                            </Button>
                          </Link>
                          <Link 
                            href={`/dashboard/documents/${document.id}/flashcards`}
                            className="flex-1"
                          >
                            <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium text-xs sm:text-sm" size="sm">
                              <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                              Study
                            </Button>
                          </Link>
                          <Link 
                            href={`/dashboard/documents/${document.id}/quiz`}
                            className="flex-1"
                          >
                            <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium text-xs sm:text-sm" size="sm">
                              <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                              Quiz
                            </Button>
                          </Link>
                        </div>
                      )}
                      
                      {document.status !== 'ready' && (
                        <Link href={`/dashboard/documents/${document.id}`}>
                          <Button variant="outline" className="w-full text-xs sm:text-sm" size="sm">
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
