import { createClient } from '@/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  Video, 
  BookOpen, 
  HelpCircle,
  Share2,
  Play,
  Clock
} from 'lucide-react'
import ShareButton from '@/components/share-button'
import DeleteVideoButton from '@/components/delete-video-button'

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

export default async function LibraryPage() {
  const videos = await getVideos()

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-5xl font-bold text-[#4B3F72] mb-3">My Library</h1>
          <p className="text-lg text-purple-700/70 font-medium">
            Your videos, flashcards, and study materials
          </p>
        </div>
        <Link href="/dashboard/upload">
          <Button size="lg" className="gap-2 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all">
            <Plus className="h-5 w-5" />
            Upload Video
          </Button>
        </Link>
      </div>

      {videos.length === 0 ? (
        <Card className="border-2 border-dashed border-purple-200 bg-white/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="mb-6 rounded-full bg-gradient-to-br from-purple-100 to-yellow-100 p-6">
              <Video className="h-16 w-16 text-[#4B3F72]" />
            </div>
            <h3 className="mb-3 text-2xl font-bold text-[#4B3F72]">No videos yet</h3>
            <p className="mb-8 text-center text-purple-700/70 max-w-md text-base font-medium">
              Get started by uploading your first video or pasting a YouTube link. 
              We'll automatically generate flashcards and questions for you.
            </p>
            <Link href="/dashboard/upload">
              <Button size="lg" className="gap-2 bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all">
                <Plus className="h-5 w-5" />
                Upload Your First Video
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video: any) => (
            <Card key={video.id} className="group transition-all hover:shadow-xl hover:-translate-y-1 bg-white border-purple-100/50 shadow-md">
              <CardHeader className="pb-3">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2 text-lg font-bold text-[#4B3F72]">{video.title}</CardTitle>
                    <CardDescription className="mt-2 text-purple-600/70 font-medium">
                      {new Date(video.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {video.status === 'ready' && (
                      <ShareButton videoId={video.id} videoTitle={video.title} />
                    )}
                    <DeleteVideoButton videoId={video.id} videoTitle={video.title} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
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
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        {Math.floor(video.duration / 60)}:
                        {String(video.duration % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  
                  {video.status === 'ready' && (
                    <div className="flex gap-2">
                      <Link 
                        href={`/dashboard/videos/${video.id}`}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium" size="sm">
                          <Video className="h-4 w-4" />
                          Watch
                        </Button>
                      </Link>
                      <Link 
                        href={`/dashboard/videos/${video.id}/flashcards`}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium" size="sm">
                          <BookOpen className="h-4 w-4" />
                          Study
                        </Button>
                      </Link>
                      <Link 
                        href={`/dashboard/videos/${video.id}/quiz`}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full gap-2 border-purple-200 text-[#4B3F72] hover:bg-purple-50 hover:border-purple-300 font-medium" size="sm">
                          <HelpCircle className="h-4 w-4" />
                          Quiz
                        </Button>
                      </Link>
                    </div>
                  )}
                  
                  {video.status !== 'ready' && (
                    <Link href={`/dashboard/videos/${video.id}`}>
                      <Button variant="outline" className="w-full" size="sm">
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
    </div>
  )
}
