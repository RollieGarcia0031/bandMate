"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Globe, Loader2, Lock, MessageCircle, Play, Upload, Users, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { type PostRow, resolvePostVideoUrl, type Visibility } from "@/lib/posts"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { supabase_config } from "@/lib/supabase/config"

type Post = {
  id: string
  title: string
  description: string
  visibility: Visibility
  videoUrl: string
  createdAt: string
  likes: number
  comments: number
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const USER_POSTS_BUCKET = supabase_config.storageBuckets.userPosts

/**
 * Build a short, user-friendly relative timestamp for post cards while keeping
 * the raw database timestamp handling isolated from the rendering logic.
 */
function formatPostCreatedAt(createdAt: string | null) {
  if (!createdAt) {
    return "Just now"
  }

  return formatDistanceToNow(new Date(createdAt), { addSuffix: true })
}

/**
 * Convert a database row into the UI model used by the page after resolving a
 * playable video URL from Supabase Storage when needed.
 */
async function mapPostRowToPost(row: PostRow): Promise<Post> {
  return {
    id: row.id,
    title: row.title?.trim() || "Untitled post",
    description: row.description?.trim() || "",
    visibility: row.visibility ?? "public",
    videoUrl: await resolvePostVideoUrl(row.video_url),
    createdAt: formatPostCreatedAt(row.created_at),
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
  }
}

export default function PostsPage() {
  // State for user's own posts
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)
  
  // State for posts the user has liked
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [isLoadingLikedPosts, setIsLoadingLikedPosts] = useState(true)

  // General page state
  const [pageError, setPageError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("public")
  const [formFeedback, setFormFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    // Load both the user's uploaded posts and the posts they've liked
    void loadUserPosts()
    void loadLikedPosts()
  }, [])

  useEffect(() => {
    return () => {
      if (videoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreview)
      }
    }
  }, [videoPreview])

  /**
   * Loads only the authenticated user's posts so the page acts as a personal
   * media library in addition to the upload form.
   */
  async function loadUserPosts() {
    setIsLoadingPosts(true)
    setPageError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error("You must be signed in to view your posts.")
      }

      const { data, error } = await supabase
        .from("posts")
        .select("id, title, description, visibility, video_url, likes_count, comments_count, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      const mappedPosts = await Promise.all((data ?? []).map((row) => mapPostRowToPost(row as PostRow)))
      setPosts(mappedPosts)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not load your posts.")
    } finally {
      setIsLoadingPosts(false)
    }
  }

  /**
   * Fetches the posts that the authenticated user has swiped "like" on.
   * We query the `swipes` table and use Supabase's foreign key relationships
   * to automatically fetch the adjoining data from the `posts` table in a single request.
   */
  async function loadLikedPosts() {
    setIsLoadingLikedPosts(true)
    setPageError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error("You must be signed in to view your liked posts.")
      }

      // Fetch swipes where the user liked a post, and join the referenced post data.
      const { data, error } = await supabase
        .from("swipes")
        .select(`
          created_at,
          posts (
            id, title, description, visibility, video_url, likes_count, comments_count, created_at
          )
        `)
        .eq("user_id", user.id)
        .eq("direction", "like")
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      // Map the nested post objects returned by the join query into our UI Post model.
      // We filter out any null posts in case a referenced post was deleted.
      const mappedPosts = await Promise.all(
        (data ?? [])
          .map((row: any) => row.posts)
          .filter(Boolean)
          .map((postRow: any) => mapPostRowToPost(postRow as PostRow))
      )
      
      setLikedPosts(mappedPosts)
    } catch (error) {
      // We don't overwrite pageError if loadUserPosts already set an error, 
      // but in a real app we might want to handle separate error states for each tab.
      setPageError((prev) => prev || (error instanceof Error ? error.message : "We could not load your liked posts."))
    } finally {
      setIsLoadingLikedPosts(false)
    }
  }

  /**
   * Replace the current local video selection while revoking the previous blob
   * preview URL to avoid leaking browser memory during repeated uploads.
   */
  function setSelectedVideo(file: File | null) {
    setVideoPreview((currentPreview) => {
      if (currentPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(currentPreview)
      }

      return file ? URL.createObjectURL(file) : null
    })

    setVideoFile(file)
  }

  function handleVideoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setFormFeedback(null)

    if (!file) {
      return
    }

    if (!file.type.startsWith("video/")) {
      setFormFeedback({ tone: "error", message: "Please select a valid video file." })
      event.target.value = ""
      return
    }

    if (file.size > MAX_VIDEO_BYTES) {
      setFormFeedback({ tone: "error", message: "Videos must be 100 MB or smaller." })
      event.target.value = ""
      return
    }

    setSelectedVideo(file)
    event.target.value = ""
  }

  /**
   * Reset the composer after cancellation or a successful upload so users do
   * not accidentally resubmit stale metadata or previews.
   */
  function resetForm() {
    setSelectedVideo(null)
    setTitle("")
    setDescription("")
    setVisibility("public")
    setFormFeedback(null)
    setIsCreating(false)
  }

  async function handleCreatePost() {
    if (!videoFile || !title.trim()) {
      setFormFeedback({ tone: "error", message: "Please select a video and enter a title." })
      return
    }

    setIsSubmitting(true)
    setFormFeedback(null)

    let uploadedStoragePath: string | null = null

    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error("You must be signed in to create a post.")
      }

      const extension = videoFile.name.split(".").pop()?.toLowerCase() || "mp4"
      const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`
      uploadedStoragePath = storagePath
      const { error: uploadError } = await supabase.storage
        .from(USER_POSTS_BUCKET)
        .upload(storagePath, videoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: videoFile.type,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: insertedPost, error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          video_url: storagePath,
        })
        .select("id, title, description, visibility, video_url, likes_count, comments_count, created_at")
        .single()

      if (insertError) {
        throw insertError
      }

      const mappedPost = await mapPostRowToPost(insertedPost as PostRow)
      setPosts((currentPosts) => [mappedPost, ...currentPosts])
      resetForm()
      setFormFeedback({ tone: "success", message: "Your video post was uploaded successfully." })
    } catch (error) {
      if (uploadedStoragePath) {
        const supabase = createSupabaseBrowserClient()
        await supabase.storage.from(USER_POSTS_BUCKET).remove([uploadedStoragePath])
      }

      setFormFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "We could not upload your post.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function getVisibilityIcon(vis: Visibility) {
    switch (vis) {
      case "public":
        return <Globe className="h-4 w-4" />
      case "private":
        return <Lock className="h-4 w-4" />
      case "followers":
        return <Users className="h-4 w-4" />
    }
  }

  function getVisibilityLabel(vis: Visibility) {
    return vis.charAt(0).toUpperCase() + vis.slice(1)
  }

  /**
   * Renders a consistent card for displaying a video post.
   * We encapsulate this here so both "My Posts" and "Liked Videos" tabs
   * share the identical visual representation of a post, ensuring consistency
   * and reducing code duplication.
   */
  function renderPostCard(post: Post) {
    return (
      <div key={post.id} className="overflow-hidden rounded-xl border border-border bg-card transition-transform hover:scale-[1.01]">
        <div className="relative aspect-[9/16] bg-secondary">
          <video src={post.videoUrl} className="h-full w-full object-cover" controls preload="metadata" />
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white">
            <Play className="h-4 w-4 fill-white" />
            Video
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
              {getVisibilityIcon(post.visibility)}
              {getVisibilityLabel(post.visibility)}
            </span>
          </div>

          <div>
            <h3 className="mb-1 line-clamp-1 font-semibold text-foreground">{post.title}</h3>
            <p className="line-clamp-2 text-sm text-muted-foreground">{post.description || "No description provided."}</p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{post.createdAt}</span>
            <div className="flex items-center gap-3">
              <span>{post.likes} likes</span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                {post.comments}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 p-4 backdrop-blur-sm lg:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Posts</h1>
            <p className="text-sm text-muted-foreground">Upload new videos and manage your library of liked content.</p>
          </div>
          <button
            onClick={() => {
              void loadUserPosts()
              void loadLikedPosts()
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            disabled={isLoadingPosts || isLoadingLikedPosts}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="p-4 lg:p-6">
          {formFeedback && (
            <div
              className={cn(
                "mb-4 rounded-lg border px-4 py-3 text-sm",
                formFeedback.tone === "success"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-destructive/50 bg-destructive/10 text-destructive"
              )}
            >
              {formFeedback.message}
            </div>
          )}

          {!isCreating ? (
            <button
              onClick={() => {
                setFormFeedback(null)
                setIsCreating(true)
              }}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Upload className="h-5 w-5" />
              Create New Post
            </button>
          ) : (
            <div className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div>
                <label className="mb-3 block text-sm font-semibold text-foreground">Upload Video</label>
                {videoPreview ? (
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-secondary">
                    <video src={videoPreview} className="h-full w-full object-cover" controls />
                    <button
                      onClick={() => setSelectedVideo(null)}
                      className="absolute right-2 top-2 rounded-full bg-background/80 p-2 transition-colors hover:bg-background"
                    >
                      <X className="h-5 w-5 text-foreground" />
                    </button>
                  </div>
                ) : (
                  <label className="flex aspect-video w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary transition-colors hover:border-primary">
                    <div className="text-center">
                      <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="font-medium text-foreground">Click to upload video</p>
                      <p className="text-sm text-muted-foreground">MP4, WebM, MOV up to 100 MB</p>
                    </div>
                    <input type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
                  </label>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Title</label>
                <div className="relative">
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value.slice(0, 100))}
                    placeholder="Enter post title"
                    maxLength={100}
                    className="w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">{title.length}/100</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">Description</label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value.slice(0, 500))}
                    placeholder="Enter post description (optional)"
                    maxLength={500}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-border bg-secondary px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute bottom-2.5 right-3 text-xs text-muted-foreground">{description.length}/500</span>
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-semibold text-foreground">Visibility</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["public", "private", "followers"] as const).map((vis) => (
                    <button
                      key={vis}
                      onClick={() => setVisibility(vis)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-3 transition-all",
                        visibility === vis
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {getVisibilityIcon(vis)}
                      <span className="text-sm font-medium">{getVisibilityLabel(vis)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={resetForm}
                  className="flex-1 rounded-lg bg-secondary px-4 py-2 font-semibold text-foreground transition-colors hover:bg-secondary/80"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreatePost()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Uploading..." : "Create Post"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 pb-24 lg:p-6 lg:pb-6">
          <Tabs defaultValue="my-posts" className="w-full">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Video Library</h2>
                <p className="text-sm text-muted-foreground">Switch between your uploads and liked content</p>
              </div>
              <TabsList>
                <TabsTrigger value="my-posts">My Posts</TabsTrigger>
                <TabsTrigger value="liked-posts">Liked Videos</TabsTrigger>
              </TabsList>
            </div>

            {pageError && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {pageError}
              </div>
            )}

            {/* My Posts Tab */}
            <TabsContent value="my-posts" className="mt-0 space-y-4">
              <div className="flex items-center justify-end">
                <div className="rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
                  {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                </div>
              </div>

              {isLoadingPosts ? (
                <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-card">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading your posts...
                  </div>
                </div>
              ) : posts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {posts.map(renderPostCard)}
                </div>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
                  <div className="mb-4 rounded-full bg-secondary p-4">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">No posts yet</h3>
                  <p className="max-w-md text-muted-foreground">Upload your first video post to start building a catalog of performances, rehearsals, and demos.</p>
                </div>
              )}
            </TabsContent>

            {/* Liked Videos Tab */}
            <TabsContent value="liked-posts" className="mt-0 space-y-4">
              <div className="flex items-center justify-end">
                <div className="rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
                  {likedPosts.length} {likedPosts.length === 1 ? 'liked video' : 'liked videos'}
                </div>
              </div>

              {isLoadingLikedPosts ? (
                <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-card">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading liked videos...
                  </div>
                </div>
              ) : likedPosts.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {likedPosts.map(renderPostCard)}
                </div>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
                  <div className="mb-4 rounded-full bg-secondary p-4">
                    <Play className="ml-1 h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">No liked videos</h3>
                  <p className="max-w-md text-muted-foreground">Swipe right on videos in the discovery feed to add them to your liked videos collection.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
