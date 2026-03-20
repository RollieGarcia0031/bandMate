"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { MusicianCard } from "@/components/app/musician-card"
import { useFeedImpressionTracker } from "@/lib/feed/use-feed-impression-tracker"
import { type FeedPostCard, loadFeedPosts } from "@/lib/feed/feed-posts"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type SwipeDirection = "like" | "pass"

export default function FeedPage() {
  const [feedPosts, setFeedPosts] = useState<FeedPostCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pendingSwipePostIds, setPendingSwipePostIds] = useState<string[]>([])

  useFeedImpressionTracker({ dwellMs: 1500, minIntersectionRatio: 0.6, source: "feed" })

  useEffect(() => {
    void refreshFeed()
  }, [])

  const visibleFeedPosts = useMemo(
    () => feedPosts.filter((post) => !pendingSwipePostIds.includes(post.id)),
    [feedPosts, pendingSwipePostIds]
  )

  async function refreshFeed() {
    setIsLoading(true)
    setPageError(null)

    try {
      const posts = await loadFeedPosts()
      setFeedPosts(posts)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We could not load your feed right now.")
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Persist the viewer's reaction and optimistically remove the card from the
   * current stack. The feed ranking itself stays simple in `loadFeedPosts()`: a
   * swipe removes the post from future fetches, while impressions only soften
   * its priority if the user saw it but did not react yet.
   */
  async function handleSwipe(postId: string, direction: SwipeDirection) {
    setPendingSwipePostIds((current) => [...current, postId])

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
        throw new Error("You must be signed in to swipe on feed posts.")
      }

      const { error } = await supabase.from("swipes").upsert(
        {
          user_id: user.id,
          post_id: postId,
          direction,
        },
        {
          onConflict: "user_id,post_id",
        }
      )

      if (error) {
        throw error
      }

      setFeedPosts((current) => current.filter((post) => post.id !== postId))
      setPageError(null)
    } catch (error) {
      setPendingSwipePostIds((current) => current.filter((currentPostId) => currentPostId !== postId))
      setPageError(error instanceof Error ? error.message : "We could not save your swipe.")
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="space-y-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div>
            <p className="text-lg font-semibold">Loading your feed</p>
            <p className="text-sm text-muted-foreground">
              We&apos;re prioritizing fresh posts from other musicians that you have not swiped on yet.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (pageError && visibleFeedPosts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-semibold">We couldn&apos;t load the feed</h1>
          <p className="text-sm text-muted-foreground">{pageError}</p>
          <button
            onClick={() => void refreshFeed()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (visibleFeedPosts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold">You&apos;re caught up</h1>
          <p className="text-sm text-muted-foreground">
            Right now there are no public posts from other musicians that are both visible to you and still unswiped.
            Once someone new shares a post, or after you clear old reactions during future tooling work, it will appear here.
          </p>
          {pageError ? <p className="text-xs text-destructive">{pageError}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
      {visibleFeedPosts.map((post) => (
        <MusicianCard
          key={post.id}
          musician={{
            id: post.authorId,
            name: post.authorName,
            videoTitle: post.videoTitle,
            videoUrl: post.videoUrl,
            likes: post.likes,
          }}
          onLike={() => void handleSwipe(post.id, "like")}
          onPass={() => void handleSwipe(post.id, "pass")}
          impressionPostId={post.id}
        />
      ))}
    </div>
  )
}
