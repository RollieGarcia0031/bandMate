"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Loader2, Play } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { getPostVideoReferenceDebugInfo, type PostRow, resolvePostVideoUrl } from "@/lib/posts"
import { cn } from "@/lib/utils"

type FeedPostRow = PostRow & {
  profiles:
    | {
        display_name: string | null
      }[]
    | null
}

type FeedPost = {
  id: string
  displayName: string
  title: string
  description: string
  videoUrl: string | null
  videoReference: string
  normalizedVideoPath: string | null
  videoReferenceKind: string
  videoError: string | null
}

/**
 * Normalize database rows into the lean UI model used by the public feed.
 * The feed intentionally exposes only creator identity, title, description,
 * and a playable video URL while the ranking algorithm is still being defined.
 */
async function mapFeedPostRow(row: FeedPostRow): Promise<FeedPost> {
  const videoDebugInfo = getPostVideoReferenceDebugInfo(row.video_url)

  const basePost = {
    id: row.id,
    displayName: row.profiles?.[0]?.display_name?.trim() || "BandMate user",
    title: row.title?.trim() || "Untitled post",
    description: row.description?.trim() || "",
    videoReference: row.video_url,
    normalizedVideoPath: videoDebugInfo.normalizedStoragePath,
    videoReferenceKind: videoDebugInfo.referenceKind,
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

function FeedPostCard({ post }: { post: FeedPost }) {
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const videoError = playbackError ?? post.videoError

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative bg-secondary">
        {post.videoUrl ? (
          <>
            <video
              src={post.videoUrl}
              className="aspect-[9/16] w-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
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
          <div className="flex aspect-[9/16] w-full items-center justify-center bg-black/90 p-6 text-center">
            <div className="max-w-md space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-destructive/20 px-3 py-1 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Video unavailable
              </div>
              <p className="text-sm text-muted-foreground">This post stayed in the feed, but its video URL could not be resolved.</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4 lg:p-5">
        {videoError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              Video failed to load
            </div>
            <p className="break-words font-mono text-xs leading-5">{videoError}</p>
          </div>
        )}

        <p className="text-sm font-medium text-primary">{post.displayName}</p>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{post.title}</h2>
          <p className={cn("text-sm leading-6 text-muted-foreground", !post.description && "italic")}>{post.description || "No description provided."}</p>
        </div>
      </div>
    </article>
  )
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    void loadFeedPosts()
  }, [])

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
        .select("id, title, description, visibility, video_url, likes_count, comments_count, created_at, profiles!inner(display_name)")
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 lg:px-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Feed</h1>
          <p className="text-sm text-muted-foreground">Showing every public video while the recommendation algorithm is still being built.</p>
        </header>

        {posts.map((post) => (
          <FeedPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
