import { supabase_config } from "@/lib/supabase/config"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type FeedPostRow = {
  id: string
  user_id: string
  title: string | null
  video_url: string
  likes_count: number | null
  created_at: string | null
}

type FeedProfileRow = {
  id: string
  username: string | null
  display_name: string | null
}

type FeedSwipeRow = {
  post_id: string
}

type FeedImpressionRow = {
  post_id: string
  seen_at: string
}

export type FeedPostCard = {
  id: string
  authorId: string
  authorName: string
  videoTitle: string
  videoUrl: string
  likes: number
}

const FEED_CANDIDATE_POOL_SIZE = 100
const MAX_FEED_POSTS = 30

/**
 * Load a simple swipe/impression-aware feed directly from Supabase.
 *
 * Current ranking rules intentionally stay lightweight:
 * 1. only public posts from other users are candidates
 * 2. posts the viewer already swiped on are removed entirely
 * 3. unseen posts rank ahead of previously impressed posts
 * 4. newer posts rank first inside each bucket
 *
 * The card UI is intentionally minimal for now, so the loader only returns the
 * author display name plus post video/title/likes that `/feed` actually shows.
 */
export async function loadFeedPosts() {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!user) {
    throw new Error("You must be signed in to view the feed.")
  }

  const { data: postRows, error: postsError } = await supabase
    .from("posts")
    .select("id, user_id, title, video_url, likes_count, created_at")
    .eq("visibility", "public")
    .neq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(FEED_CANDIDATE_POOL_SIZE)

  if (postsError) {
    throw postsError
  }

  const posts = (postRows ?? []) as FeedPostRow[]

  if (posts.length === 0) {
    return [] satisfies FeedPostCard[]
  }

  const postIds = posts.map((post) => post.id)
  const authorIds = Array.from(new Set(posts.map((post) => post.user_id)))

  const [
    { data: swipeRows, error: swipesError },
    { data: impressionRows, error: impressionsError },
    { data: profileRows, error: profilesError },
  ] = await Promise.all([
    supabase.from("swipes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
    supabase.from("feed_impressions").select("post_id, seen_at").eq("user_id", user.id).in("post_id", postIds),
    supabase.from("profiles").select("id, username, display_name").in("id", authorIds),
  ])

  if (swipesError) {
    throw swipesError
  }

  if (impressionsError) {
    throw impressionsError
  }

  if (profilesError) {
    throw profilesError
  }

  const swipedPostIds = new Set((swipeRows as FeedSwipeRow[] | null)?.map((row) => row.post_id) ?? [])
  const impressionLookup = new Map(
    ((impressionRows as FeedImpressionRow[] | null) ?? []).map((row) => [row.post_id, row.seen_at])
  )
  const profileLookup = new Map(
    ((profileRows as FeedProfileRow[] | null) ?? []).map((profile) => [profile.id, profile])
  )

  const rankedPosts = posts
    .filter((post) => !swipedPostIds.has(post.id))
    .sort((left, right) => compareFeedPosts(left, right, impressionLookup))
    .slice(0, MAX_FEED_POSTS)

  return Promise.all(
    rankedPosts.map(async (post) => {
      const author = profileLookup.get(post.user_id)

      return {
        id: post.id,
        authorId: post.user_id,
        authorName: author?.display_name?.trim() || author?.username?.trim() || "BandMate member",
        videoTitle: post.title?.trim() || "Untitled post",
        videoUrl: await resolvePostVideoUrl(post.video_url),
        likes: post.likes_count ?? 0,
      }
    })
  )
}

function compareFeedPosts(
  left: FeedPostRow,
  right: FeedPostRow,
  impressionLookup: Map<string, string>
) {
  const leftSeen = impressionLookup.has(left.id) ? 1 : 0
  const rightSeen = impressionLookup.has(right.id) ? 1 : 0

  if (leftSeen !== rightSeen) {
    return leftSeen - rightSeen
  }

  return getTimestamp(right.created_at) - getTimestamp(left.created_at)
}

function getTimestamp(value: string | null) {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

/**
 * Feed cards should play the post video itself rather than showing profile art.
 * Newer rows store a storage path, while older rows may already contain a full
 * URL, so the resolver supports both formats.
 */
async function resolvePostVideoUrl(videoReference: string) {
  if (/^https?:\/\//i.test(videoReference)) {
    return videoReference
  }

  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.storage
    .from(supabase_config.storageBuckets.userPosts)
    .createSignedUrl(videoReference, 60 * 60)

  if (error) {
    throw error
  }

  return data.signedUrl
}
