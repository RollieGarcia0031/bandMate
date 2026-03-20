"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Heart,
  Info,
  Loader2,
  Pause,
  Play,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react"
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

function formatPlaybackTime(valueInSeconds: number) {
  if (!Number.isFinite(valueInSeconds) || valueInSeconds < 0) {
    return "0:00"
  }

  const minutes = Math.floor(valueInSeconds / 60)
  const seconds = Math.floor(valueInSeconds % 60)

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

const SWIPE_THRESHOLD_PX = 120

type FeedPostCardProps = {
  post: FeedPost
  registerPost: (postId: string, element: HTMLElement | null) => void
  registerVideo: (postId: string, element: HTMLVideoElement | null) => void
  onVideoPlay: (postId: string) => void
  onVideoPause: (postId: string) => void
  onSwipeAction: (postId: string, direction: "like" | "pass") => Promise<void>
}

function FeedPostCard({
  post,
  registerPost,
  registerVideo,
  onVideoPlay,
  onVideoPause,
  onSwipeAction,
}: FeedPostCardProps) {
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [swipeOffsetX, setSwipeOffsetX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isSwipeSubmitting, setIsSwipeSubmitting] = useState(false)
  const swipeStartXRef = useRef<number | null>(null)
  const swipePointerIdRef = useRef<number | null>(null)
  const videoError = playbackError ?? post.videoError
  const postedOnLabel = formatPostDate(post.createdAt)
  const descriptionText = post.description || "No description provided."
  const swipeProgress = Math.min(Math.abs(swipeOffsetX) / SWIPE_THRESHOLD_PX, 1)
  const swipeDirectionLabel = swipeOffsetX > 0 ? "Like" : swipeOffsetX < 0 ? "Dislike" : null

  const handleVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      setVideoElement(element)
      registerVideo(post.id, element)

      if (!element) {
        return
      }

      setCurrentTime(element.currentTime)
      setDuration(Number.isFinite(element.duration) ? element.duration : 0)
      setVolume(element.volume)
      setIsMuted(element.muted)
      setIsPlaying(!element.paused)
    },
    [post.id, registerVideo],
  )

  const togglePlayback = useCallback(async () => {
    if (!videoElement) {
      return
    }

    if (videoElement.paused) {
      try {
        await videoElement.play()
      } catch {
        // Ignore autoplay/playback rejections from the browser and leave state as-is.
      }
      return
    }

    videoElement.pause()
  }, [videoElement])

  const handleVolumeChange = useCallback(
    (nextVolume: number) => {
      setVolume(nextVolume)

      if (!videoElement) {
        return
      }

      videoElement.volume = nextVolume
      videoElement.muted = nextVolume === 0
      setIsMuted(videoElement.muted)
    },
    [videoElement],
  )

  const handleMuteToggle = useCallback(() => {
    if (!videoElement) {
      return
    }

    const nextMuted = !videoElement.muted
    videoElement.muted = nextMuted
    setIsMuted(nextMuted)

    if (!nextMuted && videoElement.volume === 0) {
      videoElement.volume = 1
      setVolume(1)
    }
  }, [videoElement])

  const handleSeekChange = useCallback(
    (nextTime: number) => {
      setCurrentTime(nextTime)

      if (!videoElement) {
        return
      }

      videoElement.currentTime = nextTime
    },
    [videoElement],
  )

  const resetSwipeGesture = useCallback((pointerId?: number) => {
    setSwipeOffsetX(0)
    setIsSwiping(false)
    swipeStartXRef.current = null

    if (typeof pointerId === "number" && swipePointerIdRef.current === pointerId) {
      swipePointerIdRef.current = null
      return
    }

    if (typeof pointerId !== "number") {
      swipePointerIdRef.current = null
    }
  }, [])

  const commitSwipeAction = useCallback(
    async (direction: "like" | "pass", pointerId?: number) => {
      if (isSwipeSubmitting) {
        return
      }

      setIsSwipeSubmitting(true)

      try {
        await onSwipeAction(post.id, direction)
      } finally {
        setIsSwipeSubmitting(false)
        resetSwipeGesture(pointerId)
      }
    },
    [isSwipeSubmitting, onSwipeAction, post.id, resetSwipeGesture],
  )

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (isSwipeSubmitting) {
      return
    }

    const target = event.target as HTMLElement | null

    if (target?.closest("button, input, a, [role='dialog'], [data-no-swipe='true']")) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    swipeStartXRef.current = event.clientX
    swipePointerIdRef.current = event.pointerId
    setIsSwiping(true)
  }, [isSwipeSubmitting])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (swipePointerIdRef.current !== event.pointerId || swipeStartXRef.current === null || isSwipeSubmitting) {
      return
    }

    const nextOffset = event.clientX - swipeStartXRef.current
    setSwipeOffsetX(nextOffset)
  }, [isSwipeSubmitting])

  const handlePointerEnd = useCallback(async (event: ReactPointerEvent<HTMLElement>) => {
    if (swipePointerIdRef.current !== event.pointerId || swipeStartXRef.current === null) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalOffset = event.clientX - swipeStartXRef.current

    if (Math.abs(finalOffset) < SWIPE_THRESHOLD_PX) {
      resetSwipeGesture(event.pointerId)
      return
    }

    await commitSwipeAction(finalOffset > 0 ? "like" : "pass", event.pointerId)
  }, [commitSwipeAction, resetSwipeGesture])

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (swipePointerIdRef.current !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    resetSwipeGesture(event.pointerId)
  }, [resetSwipeGesture])

  return (
    <article
      ref={(element) => registerPost(post.id, element)}
      className="relative h-[100svh] snap-start overflow-hidden bg-black touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        void handlePointerEnd(event)
      }}
      onPointerCancel={handlePointerCancel}
      style={{
        transform: `translateX(${swipeOffsetX}px) rotate(${swipeOffsetX * 0.02}deg)`,
        transition: isSwiping ? undefined : "transform 180ms ease-out",
      }}
    >
      <div className="relative flex h-full w-full items-center justify-center bg-black">
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            className={cn(
              "absolute inset-y-0 left-0 flex w-40 items-center justify-center bg-emerald-500/20 text-emerald-200 transition-opacity",
              swipeOffsetX > 0 ? "opacity-100" : "opacity-0",
            )}
            style={{ opacity: swipeOffsetX > 0 ? swipeProgress : 0 }}
          >
            <div className="rounded-full border border-emerald-200/60 bg-black/40 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em]">
              Like
            </div>
          </div>
          <div
            className={cn(
              "absolute inset-y-0 right-0 flex w-40 items-center justify-center bg-rose-500/20 text-rose-200 transition-opacity",
              swipeOffsetX < 0 ? "opacity-100" : "opacity-0",
            )}
            style={{ opacity: swipeOffsetX < 0 ? swipeProgress : 0 }}
          >
            <div className="rounded-full border border-rose-200/60 bg-black/40 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em]">
              Dislike
            </div>
          </div>
        </div>

        {post.videoUrl ? (
          <>
            <video
              src={post.videoUrl}
              className="h-full w-full bg-black object-contain"
              playsInline
              preload="metadata"
              ref={handleVideoRef}
              onClick={() => {
                void togglePlayback()
              }}
              onLoadedMetadata={(event) => {
                setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
                setCurrentTime(event.currentTarget.currentTime)
                setVolume(event.currentTarget.volume)
                setIsMuted(event.currentTarget.muted)
              }}
              onDurationChange={(event) => {
                setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
              }}
              onTimeUpdate={(event) => {
                setCurrentTime(event.currentTarget.currentTime)
              }}
              onVolumeChange={(event) => {
                setVolume(event.currentTarget.volume)
                setIsMuted(event.currentTarget.muted)
              }}
              onPlay={() => {
                setIsPlaying(true)
                onVideoPlay(post.id)
              }}
              onPause={() => {
                setIsPlaying(false)
                onVideoPause(post.id)
              }}
              onEnded={() => {
                setIsPlaying(false)
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
            {!isPlaying ? (
              <button
                type="button"
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition hover:bg-black/30"
                onClick={() => {
                  void togglePlayback()
                }}
                aria-label={`Play ${post.title}`}
              >
                <span className="rounded-full bg-black/70 p-5 text-white shadow-lg">
                  <Play className="h-8 w-8 fill-white" />
                </span>
              </button>
            ) : null}
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

        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/70 to-transparent" />

        <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-3 sm:left-6 sm:right-6 sm:top-6">
          <div className="pointer-events-none inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
            <Play className="h-3.5 w-3.5 fill-white" />
            Video
          </div>

          <div className="group pointer-events-auto flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-white backdrop-blur-sm hover:bg-black/80 focus-within:bg-black/80">
            <button
              type="button"
              className="rounded-full text-white outline-none transition hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/70"
              onClick={handleMuteToggle}
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(event) => {
                handleVolumeChange(Number(event.target.value))
              }}
              className="w-0 cursor-pointer accent-white opacity-0 transition-all duration-200 group-hover:w-24 group-hover:opacity-100 group-focus-within:w-24 group-focus-within:opacity-100"
              aria-label="Adjust video volume"
            />
          </div>
        </div>

        {videoError ? (
          <div className="absolute left-4 right-4 top-20 z-20 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive backdrop-blur-sm sm:left-6 sm:right-6 sm:top-24">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              Video failed to load
            </div>
            <p className="break-words font-mono text-xs leading-5">{videoError}</p>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-20 space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.2em] text-white/70">
            <span>Swipe right to like</span>
            <span>{swipeDirectionLabel ? `${swipeDirectionLabel} video` : "Swipe left to dislike"}</span>
          </div>

          <div className="flex items-end justify-between gap-4">
            <h2 className="max-w-2xl text-2xl font-semibold text-white drop-shadow-sm sm:text-3xl">{post.title}</h2>

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

          <div className="flex items-center gap-3 rounded-2xl bg-black/65 px-4 py-3 text-white backdrop-blur-sm">
            <button
              type="button"
              className="rounded-full text-white outline-none transition hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/70"
              onClick={() => {
                void togglePlayback()
              }}
              aria-label={isPlaying ? `Pause ${post.title}` : `Play ${post.title}`}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
            </button>

            <span className="min-w-12 text-xs tabular-nums text-white/80">{formatPlaybackTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => {
                handleSeekChange(Number(event.target.value))
              }}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
              aria-label="Seek through video playback"
            />
            <span className="min-w-12 text-right text-xs tabular-nums text-white/80">{formatPlaybackTime(duration)}</span>
          </div>
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
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

  const handleSwipeAction = useCallback(
    async (postId: string, direction: "like" | "pass") => {
      if (!currentUserId) {
        setPageError("You need to be signed in to swipe on videos.")
        return
      }

      setPageError(null)

      try {
        const supabase = createSupabaseBrowserClient()
        const { error } = await supabase.from("swipes").upsert(
          {
            user_id: currentUserId,
            post_id: postId,
            direction,
          },
          { onConflict: "user_id,post_id" },
        )

        if (error) {
          throw error
        }

        const currentIndex = posts.findIndex((post) => post.id === postId)
        const nextIndex = Math.min(currentIndex + 1, posts.length - 1)

        if (nextIndex !== currentIndex) {
          scrollToPostAtIndex(nextIndex)
          return
        }

        void playVideoById(postId)
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "We could not save your swipe.")
      }
    },
    [currentUserId, playVideoById, posts, scrollToPostAtIndex],
  )

  useEffect(() => {
    void loadFeedPosts()
  }, [])

  useEffect(() => {
    async function loadCurrentUser() {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setCurrentUserId(user?.id ?? null)
    }

    void loadCurrentUser()
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
    <div className="min-h-screen bg-black text-white">
      <div className="snap-y snap-mandatory">
        {posts.map((post) => (
          <FeedPostCard
            key={post.id}
            post={post}
            registerPost={registerPost}
            registerVideo={registerVideo}
            onVideoPlay={handleVideoPlay}
            onVideoPause={handleVideoPause}
            onSwipeAction={handleSwipeAction}
          />
        ))}
      </div>

      <div className="fixed bottom-24 right-4 z-30 flex flex-col gap-2 sm:right-6">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-12 w-12 rounded-full bg-black/70 text-white shadow-lg hover:bg-black/80"
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
          className="h-12 w-12 rounded-full bg-black/70 text-white shadow-lg hover:bg-black/80"
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
