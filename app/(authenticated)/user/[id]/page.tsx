import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { UserRound, MapPin, Music, Briefcase, Calendar, ExternalLink, Video, ArrowLeft, Play } from "lucide-react"
import { resolvePostVideoUrl, type PostRow } from "@/lib/posts"
import { supabase_config } from "@/lib/supabase/config"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"

type UserProfile = {
  id: string
  username: string
  displayName: string
  bio: string
  city: string
  instruments: string[]
  genres: string[]
  avatar: string
  experienceLevel: string
  experienceYears: number
  youtubeUrl: string
  spotifyUrl: string
}

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      username, 
      display_name, 
      bio, 
      city, 
      experience_level, 
      experience_years, 
      youtube_url, 
      spotify_url
    `)
    .eq("id", userId)
    .maybeSingle()

  if (!profile) return null

  const [{ data: instrumentRows }, { data: genreRows }, { data: photoRows }] = await Promise.all([
    supabase
      .from("user_instruments")
      .select("instruments(name)")
      .eq("user_id", userId),
    supabase
      .from("user_genres")
      .select("genres(name)")
      .eq("user_id", userId),
    supabase
      .from("profile_photos")
      .select("url, uploaded_at")
      .eq("user_id", userId)
      .order("order", { ascending: true })
      .limit(1)
  ])

  const instruments = (instrumentRows ?? []).map((row: any) => row.instruments?.name).filter(Boolean)
  const genres = (genreRows ?? []).map((row: any) => row.genres?.name).filter(Boolean)
  
  let avatar = ""
  if (photoRows?.[0]?.url) {
    const photo = photoRows[0]
    const publicUrl = supabase.storage
      .from(supabase_config.storageBuckets.profilePhotos)
      .getPublicUrl(photo.url).data.publicUrl
    
    avatar = photo.uploaded_at ? `${publicUrl}?v=${encodeURIComponent(photo.uploaded_at)}` : publicUrl
  }

  return {
    id: userId,
    username: profile.username || "",
    displayName: profile.display_name || profile.username || "BandMate member",
    bio: profile.bio || "",
    city: profile.city || "",
    instruments,
    genres,
    avatar,
    experienceLevel: profile.experience_level || "Intermediate",
    experienceYears: profile.experience_years || 0,
    youtubeUrl: profile.youtube_url || "",
    spotifyUrl: profile.spotify_url || ""
  }
}

async function getUserPosts(userId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  return posts || []
}

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const profile = await getUserProfile(userId)
  
  if (!profile) {
    notFound()
  }

  const posts = await getUserPosts(userId)
  const supabase = await createSupabaseServerClient()

  return (
    <div className="min-h-screen pb-20 bg-background/50">
      {/* Top Navigation / Back Button */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 lg:hidden">
        <Link href="/search">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Button>
        </Link>
      </div>

      {/* Profile Header */}
      <div className="relative overflow-hidden bg-card border-b border-border pt-16 pb-12 px-4 lg:px-8">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-secondary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
            {/* Avatar */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-linear-to-tr from-primary to-secondary rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden bg-card border-4 border-card shadow-2xl shrink-0">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <UserRound className="w-20 h-20" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left space-y-6">
              <div className="space-y-1">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <h1 className="text-4xl font-extrabold text-foreground tracking-tight">{profile.displayName}</h1>
                  <span className="px-3 py-1 bg-secondary/50 text-secondary-foreground text-xs font-bold uppercase tracking-widest rounded-full md:mt-2">
                    {profile.experienceLevel}
                  </span>
                </div>
                <p className="text-xl text-muted-foreground font-medium">@{profile.username}</p>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm text-muted-foreground font-medium">
                {profile.city && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    {profile.city}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  {profile.experienceYears} Years Experience
                </div>
              </div>

              <p className="max-w-2xl text-foreground/80 leading-relaxed text-lg italic italic-font">
                "{profile.bio || "No bio."}"
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                {profile.instruments.map(inst => (
                  <span key={inst} className="px-4 py-1.5 rounded-xl bg-primary/10 text-primary text-sm font-bold border border-primary/20 shadow-xs">
                    {inst}
                  </span>
                ))}
                {profile.genres.map(genre => (
                  <span key={genre} className="px-4 py-1.5 rounded-xl bg-secondary/50 text-foreground text-sm font-bold border border-border shadow-xs">
                    {genre}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-center md:justify-start gap-4 pt-4">
                {profile.youtubeUrl && (
                  <a href={profile.youtubeUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="rounded-full gap-2 border-border/50 hover:bg-secondary transition-all">
                      <ExternalLink className="w-4 h-4" />
                      YouTube
                    </Button>
                  </a>
                )}
                {profile.spotifyUrl && (
                  <a href={profile.spotifyUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="rounded-full gap-2 border-border/50 hover:bg-secondary transition-all">
                      <ExternalLink className="w-4 h-4" />
                      Spotify
                    </Button>
                  </a>
                )}
                <Button className="rounded-full px-8 shadow-lg shadow-primary/20">Message</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-12">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Video className="w-8 h-8 text-primary" />
              Showcase
            </h2>
            <p className="text-muted-foreground font-medium">Explore their latest work and collaborations</p>
          </div>
          <div className="hidden sm:block px-4 py-2 bg-card border border-border rounded-2xl text-sm font-bold">
            {posts.length} {posts.length === 1 ? 'Post' : 'Posts'}
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-32 bg-card/50 rounded-[2.5rem] border-2 border-dashed border-border/50">
            <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Video className="w-10 h-10 text-muted-foreground opacity-30" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No videos yet</h3>
            <p className="text-muted-foreground">This musician hasn't shared any performances yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} supabase={supabase} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

async function PostCard({ post, supabase }: { post: any; supabase: any }) {
  let videoUrl = ""
  try {
    videoUrl = await resolvePostVideoUrl(post.video_url, supabase)
  } catch (e) {
    console.error("Failed to resolve video URL", e)
  }

  return (
    <div className="group relative bg-card rounded-3xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-2">
      <div className="aspect-3/4 bg-black relative">
        {videoUrl ? (
          <video 
            src={videoUrl} 
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
            muted
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary/20">
            <Video className="w-12 h-12 text-muted-foreground opacity-20" />
          </div>
        )}
        
        {/* Play Icon Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
           <div className="w-16 h-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-2xl backdrop-blur-sm">
             <Play className="w-8 h-8 fill-current translate-x-0.5" />
           </div>
        </div>

        {/* Info Gradient */}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/40 to-transparent p-6 pt-12">
          <h3 className="text-xl font-bold text-white leading-tight mb-1">{post.title || "Untitled Performance"}</h3>
          <p className="text-white/70 text-sm line-clamp-2 font-medium">{post.description}</p>
        </div>
      </div>
      
      {/* Interaction Bar */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-border/50 bg-card">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
             <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
             PUBLIC
           </div>
        </div>
        <Button variant="ghost" size="sm" className="text-primary font-bold hover:bg-primary/10">View Details</Button>
      </div>
    </div>
  )
}
