import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Brain, 
  Video, 
  BookOpen, 
  HelpCircle, 
  Zap, 
  Share2, 
  CheckCircle2,
  ArrowRight,
  PlayCircle,
  Shield,
  Lock,
  Star,
  Users,
  TrendingUp,
  Award,
  Clock,
  ChevronDown,
  HelpCircle as HelpCircleIcon
} from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard/library')
  }

  const features = [
    {
      icon: Video,
      title: 'Upload Any Video',
      description: 'Upload your own videos or paste YouTube links. We support all major video formats.',
    },
    {
      icon: Brain,
      title: 'AI-Powered Transcription',
      description: 'Automatically transcribe videos with OpenAI Whisper for accurate, timestamped transcripts.',
    },
    {
      icon: BookOpen,
      title: 'Smart Flashcards',
      description: 'Generate flashcards with spaced repetition to help you remember key concepts.',
    },
    {
      icon: HelpCircle,
      title: 'Practice Questions',
      description: 'Create multiple-choice, true/false, and short answer questions to test your knowledge.',
    },
    {
      icon: Zap,
      title: 'Instant Generation',
      description: 'Get flashcards and questions in seconds, not hours. Study smarter, not harder.',
    },
    {
      icon: Share2,
      title: 'Share & Collaborate',
      description: 'Share your study materials with friends and classmates for collaborative learning.',
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="border-b border-purple-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-[#4B3F72] hover:text-[#5A4A82] transition-colors">
            <Brain className="h-7 w-7 text-[#4B3F72]" />
            Prexam
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-[#4B3F72] hover:bg-purple-50 font-medium">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-lg hover:shadow-xl transition-all">Sign up for free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-outseta py-24 sm:py-32">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-purple-300/20 blur-3xl animate-pulse-slow"></div>
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-yellow-300/20 blur-3xl animate-pulse-slow delay-300"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-purple-200/10 blur-3xl animate-float"></div>
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white/90 backdrop-blur-sm px-5 py-2.5 text-sm font-medium shadow-sm animate-fade-in-up delay-100">
              <Zap className="h-4 w-4 text-[#FBBF24] animate-pulse" />
              <span className="text-[#4B3F72]">AI-Powered Study Platform</span>
            </div>
            <h1 className="mb-8 text-5xl font-bold tracking-tight text-[#4B3F72] sm:text-6xl lg:text-7xl animate-fade-in-up delay-200">
              The Study Operating System
          </h1>
            <p className="mb-10 text-xl text-purple-700/80 sm:text-2xl font-medium leading-relaxed animate-fade-in-up delay-300">
              Upload any video, get instant flashcards and practice questions. 
              <strong className="text-[#4B3F72]"> Study smarter with AI-powered learning tools</strong> that transform your videos into comprehensive study materials.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in-up delay-400">
              <Link href="/signup">
                <Button size="lg" className="group bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-xl hover:shadow-2xl transition-all hover:scale-105 text-lg px-8 py-6">
                  Sign up for free
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-2 border-[#4B3F72] text-[#4B3F72] hover:bg-[#4B3F72] hover:text-white font-semibold transition-all hover:scale-105">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  See How It Works
                </Button>
              </Link>
            </div>
            <p className="mt-8 text-sm text-purple-700/70 font-medium animate-fade-in-up delay-500">
              No credit card required • Free forever • Start in seconds
            </p>
            
            {/* Trust Indicators */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 animate-fade-in-up delay-600">
              <div className="flex items-center gap-2 text-sm text-purple-700/80">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-medium">Secure & Private</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-purple-700/80">
                <Lock className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Encrypted Data</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-purple-700/80">
                <Award className="h-5 w-5 text-yellow-600" />
                <span className="font-medium">Trusted by 10,000+ Students</span>
              </div>
            </div>

            {/* Social Proof Stats */}
            <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4 animate-fade-in-up delay-700">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#4B3F72]">10K+</div>
                <div className="text-sm text-purple-700/70 font-medium">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#4B3F72]">50K+</div>
                <div className="text-sm text-purple-700/70 font-medium">Videos Processed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#4B3F72]">4.9/5</div>
                <div className="flex items-center justify-center gap-1 text-sm text-purple-700/70">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">User Rating</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#4B3F72]">99.9%</div>
                <div className="text-sm text-purple-700/70 font-medium">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="relative -mt-20 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-2xl border-4 border-purple-200/50 bg-gradient-to-br from-[#4B3F72] to-[#5A4A82] shadow-2xl animate-fade-in-up delay-300 hover:shadow-3xl transition-shadow duration-500">
            {/* Dashboard Header */}
            <div className="border-b border-purple-300/30 bg-[#4B3F72]/50 backdrop-blur-sm px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Brain className="h-6 w-6 text-white" />
                  <span className="text-xl font-bold text-white">Prexam Dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-400"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                  <div className="h-3 w-3 rounded-full bg-red-400"></div>
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="bg-white p-8">
              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold text-[#4B3F72]">My Library</h3>
                <p className="text-purple-700/70 font-medium">Your videos, flashcards, and study materials</p>
              </div>

              {/* Video Cards Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Video Card 1 */}
                <div className="group rounded-xl border-2 border-purple-100 bg-white p-5 shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
                  <div className="mb-3 aspect-video rounded-lg bg-gradient-to-br from-purple-200 to-yellow-200 flex items-center justify-center">
                    <Video className="h-12 w-12 text-[#4B3F72] opacity-50" />
                  </div>
                  <h4 className="mb-2 font-bold text-[#4B3F72]">Introduction to React</h4>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">
                      ready
                    </span>
                    <span className="text-xs text-purple-600/70">12:34</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-md bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-[#4B3F72]">
                      Watch
                    </div>
                    <div className="flex-1 rounded-md bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-[#4B3F72]">
                      Study
                    </div>
                    <div className="flex-1 rounded-md bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-[#4B3F72]">
                      Quiz
                    </div>
                  </div>
                </div>

                {/* Video Card 2 */}
                <div className="group rounded-xl border-2 border-purple-100 bg-white p-5 shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
                  <div className="mb-3 aspect-video rounded-lg bg-gradient-to-br from-yellow-200 to-purple-200 flex items-center justify-center">
                    <Video className="h-12 w-12 text-[#4B3F72] opacity-50" />
                  </div>
                  <h4 className="mb-2 font-bold text-[#4B3F72]">JavaScript Fundamentals</h4>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">
                      ready
                    </span>
                    <span className="text-xs text-purple-600/70">08:15</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-md bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-[#4B3F72]">
                      Watch
                    </div>
                    <div className="flex-1 rounded-md bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-[#4B3F72]">
                      Study
                    </div>
                    <div className="flex-1 rounded-md bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-[#4B3F72]">
                      Quiz
                    </div>
                  </div>
                </div>

                {/* Video Card 3 */}
                <div className="group rounded-xl border-2 border-purple-100 bg-white p-5 shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
                  <div className="mb-3 aspect-video rounded-lg bg-gradient-to-br from-purple-200 via-yellow-200 to-purple-200 flex items-center justify-center">
                    <Video className="h-12 w-12 text-[#4B3F72] opacity-50" />
                  </div>
                  <h4 className="mb-2 font-bold text-[#4B3F72]">Advanced TypeScript</h4>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-700 border border-yellow-200">
                      transcribing
                    </span>
                    <span className="text-xs text-purple-600/70">--:--</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-gray-500">
                      View Details
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-yellow-50 border border-purple-200 p-4">
                  <div className="text-2xl font-bold text-[#4B3F72]">24</div>
                  <div className="text-sm text-purple-700/70 font-medium">Videos</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-yellow-50 border border-purple-200 p-4">
                  <div className="text-2xl font-bold text-[#4B3F72]">156</div>
                  <div className="text-sm text-purple-700/70 font-medium">Flashcards</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-yellow-50 border border-purple-200 p-4">
                  <div className="text-2xl font-bold text-[#4B3F72]">89</div>
                  <div className="text-sm text-purple-700/70 font-medium">Questions</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-yellow-50 border border-purple-200 p-4">
                  <div className="text-2xl font-bold text-[#4B3F72]">92%</div>
                  <div className="text-sm text-purple-700/70 font-medium">Avg Score</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section - Before Features */}
      <section className="py-20 bg-gradient-to-b from-white to-purple-50/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center animate-fade-in-up delay-100">
            <h2 className="mb-4 text-4xl font-bold text-[#4B3F72]">Loved by Students Worldwide</h2>
            <p className="text-lg text-purple-700/70 font-medium">
              See what our users are saying about Prexam
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border-2 border-purple-100 bg-white p-6 shadow-md animate-fade-in-up delay-200">
              <div className="mb-4 flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="mb-4 text-purple-700/80 font-medium leading-relaxed">
                "Prexam transformed how I study. The AI-generated flashcards are incredibly accurate and the spaced repetition system actually works!"
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-200 to-yellow-200 flex items-center justify-center">
                  <Users className="h-5 w-5 text-[#4B3F72]" />
                </div>
                <div>
                  <div className="font-semibold text-[#4B3F72]">Sarah Chen</div>
                  <div className="text-sm text-purple-600/70">Medical Student</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border-2 border-purple-100 bg-white p-6 shadow-md animate-fade-in-up delay-300">
              <div className="mb-4 flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="mb-4 text-purple-700/80 font-medium leading-relaxed">
                "I've saved hours of study time. The automatic transcription and question generation is a game-changer for my exam prep."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-200 to-purple-200 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-[#4B3F72]" />
                </div>
                <div>
                  <div className="font-semibold text-[#4B3F72]">Marcus Johnson</div>
                  <div className="text-sm text-purple-600/70">Engineering Student</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border-2 border-purple-100 bg-white p-6 shadow-md animate-fade-in-up delay-400">
              <div className="mb-4 flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="mb-4 text-purple-700/80 font-medium leading-relaxed">
                "The best study tool I've ever used. The interface is clean, the features are powerful, and it's completely free!"
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-200 via-yellow-200 to-purple-200 flex items-center justify-center">
                  <Award className="h-5 w-5 text-[#4B3F72]" />
                </div>
                <div>
                  <div className="font-semibold text-[#4B3F72]">Emily Rodriguez</div>
                  <div className="text-sm text-purple-600/70">Law Student</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-purple-100/30 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-yellow-100/30 blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mb-20 text-center animate-fade-in-up delay-100">
            <h2 className="mb-6 text-5xl font-bold text-[#4B3F72]">Everything You Need to Study Smarter</h2>
            <p className="text-xl text-purple-700/70 font-medium">
              Powerful features designed to help you learn faster and remember longer
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`group rounded-xl border-2 border-purple-100 bg-white p-8 shadow-md transition-all hover:shadow-xl hover:-translate-y-2 hover:border-purple-200 hover:scale-105 animate-fade-in-up delay-${(index + 1) * 100}`}
                style={{
                  animationDelay: `${(index + 1) * 0.1}s`,
                  opacity: 0,
                }}
              >
                <div className="mb-6 inline-flex rounded-xl bg-gradient-to-br from-purple-100 to-yellow-100 p-4 transition-transform group-hover:scale-110 group-hover:rotate-3">
                  <feature.icon className="h-7 w-7 text-[#4B3F72] transition-transform group-hover:scale-110" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-[#4B3F72] transition-colors group-hover:text-[#5A4A82]">{feature.title}</h3>
                <p className="text-purple-700/70 font-medium leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 gradient-outseta-subtle relative overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 animate-gradient bg-gradient-to-br from-purple-50 via-yellow-50 to-purple-50 opacity-50"></div>
        
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mb-20 text-center animate-fade-in-up delay-100">
            <h2 className="mb-6 text-5xl font-bold text-[#4B3F72]">How It Works</h2>
            <p className="text-xl text-purple-700/70 font-medium">Get started in three simple steps</p>
          </div>
          <div className="grid gap-10 md:grid-cols-3">
            <div className="text-center group animate-fade-in-up delay-200" style={{ animationDelay: '0.2s', opacity: 0 }}>
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#4B3F72] text-3xl font-bold text-white shadow-lg transition-all group-hover:scale-110 group-hover:rotate-12 group-hover:shadow-xl">
                1
              </div>
              <h3 className="mb-3 text-2xl font-bold text-[#4B3F72] transition-colors group-hover:text-[#5A4A82]">Upload Your Video</h3>
              <p className="text-purple-700/70 font-medium leading-relaxed">
                Upload a video file or paste a YouTube link. We support all major formats.
              </p>
            </div>
            <div className="text-center group animate-fade-in-up delay-300" style={{ animationDelay: '0.4s', opacity: 0 }}>
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#4B3F72] text-3xl font-bold text-white shadow-lg transition-all group-hover:scale-110 group-hover:rotate-12 group-hover:shadow-xl">
                2
              </div>
              <h3 className="mb-3 text-2xl font-bold text-[#4B3F72] transition-colors group-hover:text-[#5A4A82]">AI Does the Work</h3>
              <p className="text-purple-700/70 font-medium leading-relaxed">
                Our AI transcribes, analyzes, and generates study materials automatically.
              </p>
            </div>
            <div className="text-center group animate-fade-in-up delay-400" style={{ animationDelay: '0.6s', opacity: 0 }}>
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#4B3F72] text-3xl font-bold text-white shadow-lg transition-all group-hover:scale-110 group-hover:rotate-12 group-hover:shadow-xl">
                3
              </div>
              <h3 className="mb-3 text-2xl font-bold text-[#4B3F72] transition-colors group-hover:text-[#5A4A82]">Start Studying</h3>
              <p className="text-purple-700/70 font-medium leading-relaxed">
                Review flashcards, take quizzes, and track your progress with spaced repetition.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits/Why Choose Section */}
      <section className="py-24 bg-gradient-to-b from-white to-purple-50/50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center animate-fade-in-up delay-100">
            <h2 className="mb-6 text-5xl font-bold text-[#4B3F72]">Why Choose Prexam?</h2>
            <p className="text-xl text-purple-700/70 font-medium">
              Built for students, trusted by thousands
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center animate-fade-in-up delay-200">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-yellow-100">
                <Clock className="h-8 w-8 text-[#4B3F72]" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-[#4B3F72]">Save Time</h3>
              <p className="text-purple-700/70 font-medium">
                Automate your study material creation and focus on learning
              </p>
            </div>
            <div className="text-center animate-fade-in-up delay-300">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 to-purple-100">
                <TrendingUp className="h-8 w-8 text-[#4B3F72]" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-[#4B3F72]">Better Results</h3>
              <p className="text-purple-700/70 font-medium">
                Proven spaced repetition system improves retention by 40%
              </p>
            </div>
            <div className="text-center animate-fade-in-up delay-400">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 via-yellow-100 to-purple-100">
                <Shield className="h-8 w-8 text-[#4B3F72]" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-[#4B3F72]">100% Free</h3>
              <p className="text-purple-700/70 font-medium">
                No hidden costs, no credit card required, forever free
              </p>
            </div>
            <div className="text-center animate-fade-in-up delay-500">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 via-purple-100 to-yellow-100">
                <Zap className="h-8 w-8 text-[#4B3F72]" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-[#4B3F72]">Instant Setup</h3>
              <p className="text-purple-700/70 font-medium">
                Get started in under 60 seconds, no complex setup needed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 bg-gradient-to-br from-[#4B3F72] to-[#5A4A82] overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-yellow-300/20 blur-3xl animate-float delay-300"></div>
        </div>
        
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-6 text-5xl font-bold text-white animate-fade-in-up delay-100">
            Ready to Transform Your Learning?
          </h2>
          <p className="mb-8 text-xl text-purple-100 font-medium animate-fade-in-up delay-200">
            Join 10,000+ students who are studying smarter with Prexam
          </p>
          
          {/* Trust Badges */}
          <div className="mb-10 flex flex-wrap items-center justify-center gap-6 text-sm text-purple-100 animate-fade-in-up delay-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-300" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-300" />
              <span>Free forever</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-300" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-300" />
              <span>100% secure</span>
            </div>
          </div>

          <Link href="/signup" className="inline-block animate-fade-in-up delay-400">
            <Button size="lg" className="group bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1F2937] font-semibold shadow-2xl hover:shadow-3xl transition-all hover:scale-105 text-lg px-10 py-7">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          
          <p className="mt-6 text-sm text-purple-200 animate-fade-in-up delay-500">
            ⚡ Setup takes less than 60 seconds
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-[#4B3F72]" />
              <span className="text-xl font-bold text-[#4B3F72]">Prexam</span>
            </div>
            <div className="flex gap-6 text-sm text-purple-700/70 font-medium">
              <Link href="#" className="hover:text-[#4B3F72] transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-[#4B3F72] transition-colors">Terms</Link>
              <Link href="#" className="hover:text-[#4B3F72] transition-colors">Contact</Link>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-purple-600/60 font-medium">
            © {new Date().getFullYear()} Prexam. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
