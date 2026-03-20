import { supabase_config } from "@/lib/supabase/config"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type FeedPostRow = {
  id: string
  user_id: string
  title: string | null
  description: string | null
  thumbnail_url: string | null
  created_at: string | null
}

type FeedProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  city: string | null
  bio: string | null
  birthday: string | null
}

type FeedSwipeRow = {
  post_id: string
}

type FeedImpressionRow = {
  post_id: string
  seen_at: string
}

type FeedPhotoRow = {
  user_id: string
  url: string
  order: number
}

type FeedInstrumentJoinRow = {
  user_id: string
  instruments: { name: string } | { name: string }[] | null
}

type FeedGenreJoinRow = {
  user_id: string
  genres: { name: string } | { name: string }[] | null
}

export type FeedPostCard = {
  id: string
  authorId: string
  authorName: string
  authorUsername: string
  age: number | null
  location: string
  instruments: string[]
  genres: string[]
  postTitle: string
  postBody: string
  imageUrl: string
  createdAt: string | null
  hasBeenSeen: boolean
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
 * This keeps the implementation easy to reason about while still making both
 * `swipes` and `feed_impressions` affect what shows up in `/feed`.
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
    .select("id, user_id, title, description, thumbnail_url, created_at")
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
    { data: photoRows, error: photosError },
    { data: instrumentRows, error: instrumentsError },
    { data: genreRows, error: genresError },
  ] = await Promise.all([
    supabase.from("swipes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
    supabase.from("feed_impressions").select("post_id, seen_at").eq("user_id", user.id).in("post_id", postIds),
    supabase.from("profiles").select("id, username, display_name, city, bio, birthday").in("id", authorIds),
    supabase.from("profile_photos").select("user_id, url, order").in("user_id", authorIds).order("order", { ascending: true }),
    supabase.from("user_instruments").select("user_id, instruments(name)").in("user_id", authorIds),
    supabase.from("user_genres").select("user_id, genres(name)").in("user_id", authorIds),
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

  if (photosError) {
    throw photosError
  }

  if (instrumentsError) {
    throw instrumentsError
  }

  if (genresError) {
    throw genresError
  }

  const swipedPostIds = new Set((swipeRows as FeedSwipeRow[] | null)?.map((row) => row.post_id) ?? [])
  const impressionLookup = new Map(
    ((impressionRows as FeedImpressionRow[] | null) ?? []).map((row) => [row.post_id, row.seen_at])
  )
  const profileLookup = new Map(
    ((profileRows as FeedProfileRow[] | null) ?? []).map((profile) => [profile.id, profile])
  )
  const photoLookup = new Map<string, string>()

  for (const row of (photoRows as FeedPhotoRow[] | null) ?? []) {
    if (!photoLookup.has(row.user_id)) {
      photoLookup.set(row.user_id, resolveProfilePhotoUrl(row.url))
    }
  }

  const instrumentsByUser = buildJoinedNameLookup(
    (instrumentRows as FeedInstrumentJoinRow[] | null) ?? [],
    "instruments"
  )
  const genresByUser = buildJoinedNameLookup(
    (genreRows as FeedGenreJoinRow[] | null) ?? [],
    "genres"
  )

  return posts
    .filter((post) => !swipedPostIds.has(post.id))
    .sort((left, right) => compareFeedPosts(left, right, impressionLookup))
    .slice(0, MAX_FEED_POSTS)
    .map((post) => {
      const author = profileLookup.get(post.user_id)
      const imageUrl = post.thumbnail_url?.trim() || photoLookup.get(post.user_id) || createFeedPlaceholder(author?.display_name)

      return {
        id: post.id,
        authorId: post.user_id,
        authorName: author?.display_name?.trim() || author?.username?.trim() || "BandMate member",
        authorUsername: author?.username?.trim() || "",
        age: calculateAge(author?.birthday ?? null),
        location: author?.city?.trim() || "Location not added yet",
        instruments: instrumentsByUser.get(post.user_id) ?? [],
        genres: genresByUser.get(post.user_id) ?? [],
        postTitle: post.title?.trim() || "Untitled post",
        postBody: post.description?.trim() || author?.bio?.trim() || "This musician has not added details for this post yet.",
        imageUrl,
        createdAt: post.created_at,
        hasBeenSeen: impressionLookup.has(post.id),
      }
    })
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

function buildJoinedNameLookup<Row extends { user_id: string }>(
  rows: Row[],
  relationKey: keyof Row
) {
  const lookup = new Map<string, string[]>()

  for (const row of rows) {
    const names = normalizeJoinedNames(row[relationKey])

    if (!names.length) {
      continue
    }

    lookup.set(row.user_id, [...(lookup.get(row.user_id) ?? []), ...names])
  }

  return lookup
}

function normalizeJoinedNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeJoinedNames(entry))
  }

  if (value && typeof value === "object" && "name" in value && typeof value.name === "string") {
    return [value.name]
  }

  return []
}

function resolveProfilePhotoUrl(photoUrl: string) {
  if (/^https?:\/\//i.test(photoUrl)) {
    return photoUrl
  }

  return createSupabaseBrowserClient()
    .storage
    .from(supabase_config.storageBuckets.profilePhotos)
    .getPublicUrl(photoUrl).data.publicUrl
}

function calculateAge(birthday: string | null) {
  if (!birthday) {
    return null
  }

  const birthDate = new Date(birthday)

  if (Number.isNaN(birthDate.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear()
  const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1
  }

  return age >= 0 ? age : null
}

function createFeedPlaceholder(displayName: string | null | undefined) {
  const safeName = (displayName?.trim() || "BandMate member").slice(0, 40)
  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "BM"

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#171717"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><rect width="1200" height="1600" fill="url(#g)"/><text x="50%" y="45%" fill="#fafafa" font-family="Arial, sans-serif" font-size="220" text-anchor="middle">${initials}</text><text x="50%" y="58%" fill="#e5e7eb" font-family="Arial, sans-serif" font-size="56" text-anchor="middle">${escapeXml(safeName)}</text></svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}
