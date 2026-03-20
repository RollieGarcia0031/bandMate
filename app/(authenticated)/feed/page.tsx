"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, CalendarDays, ChevronDown, ChevronUp, Heart, Info, Loader2, Play, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { getPostVideoReferenceDebugInfo, type PostRow, resolvePostVideoUrl } from "@/lib/posts"
import { cn } from "@/lib/utils"

type FeedPostProfile = {
  display_name: string | null
  username: string | null
}

type FeedPostRow = PostRow & {
  profiles: FeedPostProfile | FeedPostProfile[] | null
}

type FeedPost = {
  id: string
  displayName: string
  username: string | null
  title: string
  description: string
  videoUrl: string | null
  videoReference: string
  normalizedVideoPath: string | null
  videoReferenceKind: string
  videoError: string | null
  likes: number
  comments: number
  createdAt: string | null
}

/**
 * Normalize database rows into the lean UI model used by the public feed.
 * The feed intentionally exposes creator identity, post details, and a playable
 * video URL while the ranking algorithm is still being defined.
 */
async function mapFeedPostRow(row: FeedPostRow): Promise<FeedPost> {
  const videoDebugInfo = getPostVideoReferenceDebugInfo(row.video_url)
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  const fallbackUsername = profile?.username?.trim() || null

  const basePost = {
    id: row.id,
    displayName: profile?.display_name?.trim() || fallbackUsername || "BandMate user",
    username: fallbackUsername,
    title: row.title?.trim() || "Untitled post",
    description: row.description?.trim() || "",
    videoReference: row.video_url,
    normalizedVideoPath: videoDebugInfo.normalizedStoragePath,
    videoReferenceKind: videoDebugInfo.referenceKind,
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
    createdAt: row.created_at,
  }

  try {
    return {
      ...basePost,
      videoUrl: await resolvePostVideoUrl(row.video_url),
      videoError: null,
    }
  } catch (error) {
    return {
      ...basePost,
      videoUrl: null,
      videoError: [
        `Video URL resolution failed for post ${row.id}.`,
        error instanceof Error ? error.message : "Unknown video resolution error.",
      ].join(" "),
    }
  }
}

function formatPostDate(createdAt: string | null) {
  if (!createdAt) {
    return "Recently posted"
  }

  const parsedDate = new Date(createdAt)

  if (Number.isNaN(parsedDate.getTime())) {
    return "Recently posted"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate)
}

type FeedPostCardProps = {
  post: FeedPost
  registerPost: (postId: string, element: HTMLElement | null) => void
  registerVideo: (postId: string, element: HTMLVideoElement | null) => void
  onVideoPlay: (postId: string) => void
  onVideoPause: (postId: string) => void
}

function FeedPostCard({ post, registerPost, registerVideo, onVideoPlay, onVideoPause }: FeedPostCardProps) {
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const videoError = playbackError ?? post.videoError
  const postedOnLabel = formatPostDate(post.createdAt)
  const descriptionText = post.description || "No description provided."

  return (
    <article
      ref={(element) => registerPost(post.id, element)}
      className="relative h-[calc(100svh-10rem)] min-h-[32rem] snap-start overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
    >
      <div className="relative flex h-full items-center justify-center bg-black">
        {post.videoUrl ? (
          <>
            <video
              src={post.videoUrl}
              className="h-full w-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
              ref={(element) => registerVideo(post.id, element)}
              onPlay={() => {
                onVideoPlay(post.id)
              }}
              onPause={() => {
                onVideoPause(post.id)
              }}
              onEnded={() => {
                onVideoPause(post.id)
              }}
              onError={() => {
                setPlaybackError(
                  [
                    `Video playback failed for post ${post.id}.`,
                    `referenceKind=${post.videoReferenceKind}`,
                    `storedVideoUrl=${JSON.stringify(post.videoReference)}`,
                    `normalizedStoragePath=${JSON.stringify(post.normalizedVideoPath)}`,
                    `resolvedVideoUrl=${JSON.stringify(post.videoUrl)}`,
                    `Check that this object exists in the configured Supabase bucket and that the signed URL matches the stored path.`,
                  ].join(" "),
                )
              }}
            />
            <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
              <Play className="h-3.5 w-3.5 fill-white" />
              Video
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/90 p-6 text-center">
            <div className="max-w-md space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-destructive/20 px-3 py-1 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Video unavailable
              </div>
              <p className="text-sm text-muted-foreground">This post stayed in the feed, but its video URL could not be resolved.</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/65 to-transparent" />

        {videoError ? (
          <div className="absolute left-4 right-4 top-16 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              Video failed to load
            </div>
            <p className="break-words font-mono text-xs leading-5">{videoError}</p>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
          <h2 className="max-w-2xl text-xl font-semibold text-white drop-shadow-sm sm:text-2xl">{post.title}</h2>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" className="shrink-0 rounded-full bg-white text-black hover:bg-white/90">
                View full details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{post.title}</DialogTitle>
                <DialogDescription>Full post details from the BandMate feed.</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
                  <p className={cn("text-sm leading-6 text-foreground", !post.description && "italic text-muted-foreground")}>
                    {descriptionText}
                  </p>
                </section>

                <section className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Creator</p>
                      <p className="text-sm text-foreground">{post.displayName}</p>
                      {post.username ? <p className="text-xs text-muted-foreground">@{post.username}</p> : null}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Posted</p>
                      <p className="text-sm text-foreground">{postedOnLabel}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Heart className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likes</p>
                      <p className="text-sm text-foreground">{post.likes}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Info</p>
                      <p className="text-sm text-foreground">{post.comments} comments • Public post</p>
                    </div>
                  </div>
                </section>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </article>
  )
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const videoElementsRef = useRef<Record<string, HTMLVideoElement | null>>({})
  const postElementsRef = useRef<Record<string, HTMLElement | null>>({})

  const registerVideo = useCallback((postId: string, element: HTMLVideoElement | null) => {
    if (element) {
      videoElementsRef.current[postId] = element
      return
    }

    delete videoElementsRef.current[postId]
  }, [])

  const registerPost = useCallback((postId: string, element: HTMLElement | null) => {
    if (element) {
      postElementsRef.current[postId] = element
      return
    }

    delete postElementsRef.current[postId]
  }, [])

  const handleVideoPlay = useCallback((postId: string) => {
    Object.entries(videoElementsRef.current).forEach(([otherPostId, element]) => {
      if (otherPostId !== postId && element && !element.paused) {
        element.pause()
      }
    })

    setActiveVideoId(postId)
  }, [])

  const handleVideoPause = useCallback((postId: string) => {
    setActiveVideoId((currentVideoId) => (currentVideoId === postId ? null : currentVideoId))
  }, [])

  const playVideoById = useCallback(
    async (postId: string) => {
      const videoElement = videoElementsRef.current[postId]

      if (!videoElement) {
        setActiveVideoId(postId)
        return
      }

      Object.entries(videoElementsRef.current).forEach(([otherPostId, element]) => {
        if (otherPostId !== postId && element && !element.paused) {
          element.pause()
        }
      })

      try {
        await videoElement.play()
      } catch {
        setActiveVideoId(postId)
      }
    },
    [],
  )

  const getCurrentPostIndex = useCallback(() => {
    if (typeof window === "undefined") {
      return 0
    }

    if (activeVideoId) {
      const activeIndex = posts.findIndex((post) => post.id === activeVideoId)

      if (activeIndex >= 0) {
        return activeIndex
      }
    }

    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY
    const viewportCenter = window.innerHeight / 2

    posts.forEach((post, index) => {
      const element = postElementsRef.current[post.id]

      if (!element) {
        return
      }

      const rect = element.getBoundingClientRect()
      const elementCenter = rect.top + rect.height / 2
      const distanceToCenter = Math.abs(elementCenter - viewportCenter)

      if (distanceToCenter < closestDistance) {
        closestDistance = distanceToCenter
        closestIndex = index
      }
    })

    return closestIndex
  }, [activeVideoId, posts])

  const scrollToPostAtIndex = useCallback(
    (targetIndex: number) => {
      const targetPost = posts[targetIndex]

      if (!targetPost) {
        return
      }

      postElementsRef.current[targetPost.id]?.scrollIntoView({ behavior: "smooth", block: "start" })
      window.setTimeout(() => {
        void playVideoById(targetPost.id)
      }, 350)
    },
    [playVideoById, posts],
  )

  const scrollToPreviousPost = useCallback(() => {
    const currentIndex = getCurrentPostIndex()
    scrollToPostAtIndex(Math.max(currentIndex - 1, 0))
  }, [getCurrentPostIndex, scrollToPostAtIndex])

  const scrollToNextPost = useCallback(() => {
    const currentIndex = getCurrentPostIndex()
    scrollToPostAtIndex(Math.min(currentIndex + 1, posts.length - 1))
  }, [getCurrentPostIndex, posts.length, scrollToPostAtIndex])

  useEffect(() => {
    void loadFeedPosts()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault()
        scrollToPreviousPost()
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        scrollToNextPost()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [scrollToNextPost, scrollToPreviousPost])

  useEffect(() => {
    if (!activeVideoId) {
      return
    }

    const activeVideo = videoElementsRef.current[activeVideoId]

    if (!activeVideo) {
      setActiveVideoId(null)
    }
  }, [activeVideoId])

  /**
   * Load every public post for the temporary all-videos feed ordered first by
   * newest uploads, then by like totals when timestamps are equal.
   */
  async function loadFeedPosts() {
    setIsLoading(true)
    setPageError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, description, visibility, video_url, likes_count, comments_count, created_at, profiles!inner(display_name, username)")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .order("likes_count", { ascending: false })

      if (error) {
        throw error
      }

      const mappedPosts = await Promise.all((data ?? []).map((row) => mapFeedPostRow(row as FeedPostRow)))
      setPosts(mappedPosts)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not load the feed right now.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading videos...
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-2xl rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          <div className="mb-2 flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Feed failed to load
          </div>
          <p className="break-words font-mono text-xs leading-5">{pageError}</p>
        </div>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <h1 className="text-xl font-semibold text-foreground">Feed coming soon</h1>
          <p className="mt-2 text-sm text-muted-foreground">No public videos have been posted yet.</p>
        </div>
      </div>
    )
  }

  const currentIndex = getCurrentPostIndex()

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 lg:px-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Feed</h1>
          <p className="text-sm text-muted-foreground">Showing every public video while the recommendation algorithm is still being built.</p>
        </header>

        <div className="space-y-4 snap-y snap-mandatory">
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              registerPost={registerPost}
              registerVideo={registerVideo}
              onVideoPlay={handleVideoPlay}
              onVideoPause={handleVideoPause}
            />
          ))}
        </div>
      </div>

      <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2 sm:right-6">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={scrollToPreviousPost}
          disabled={currentIndex <= 0}
          aria-label="Go to previous video"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={scrollToNextPost}
          disabled={currentIndex >= posts.length - 1}
          aria-label="Go to next video"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
