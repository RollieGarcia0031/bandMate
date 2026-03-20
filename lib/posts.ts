import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { supabase_config } from "@/lib/supabase/config"

export type Visibility = "public" | "private" | "followers"

export type PostRow = {
  id: string
  title: string | null
  description: string | null
  visibility: Visibility | null
  video_url: string
  likes_count: number | null
  comments_count: number | null
  created_at: string | null
}

const USER_POSTS_BUCKET = supabase_config.storageBuckets.userPosts

/**
 * Normalize a persisted post video reference into the storage object path used
 * by Supabase Storage APIs.
 *
 * Historical rows may contain a plain storage path, a bucket-prefixed path, or
 * even an older signed/public Supabase Storage URL. Returning `null` signals
 * that the reference should be used as-is because it points to an external URL.
 */
function normalizeUserPostStoragePath(videoReference: string) {
  const trimmedReference = videoReference.trim()
  const bucketPrefix = `${USER_POSTS_BUCKET}/`

  if (!trimmedReference) {
    return ""
  }

  if (!/^https?:\/\//i.test(trimmedReference)) {
    return trimmedReference.startsWith(bucketPrefix)
      ? trimmedReference.slice(bucketPrefix.length)
      : trimmedReference
  }

  try {
    const parsedUrl = new URL(trimmedReference)
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean)
    const storageMarkerIndex = pathSegments.indexOf("object")

    if (storageMarkerIndex === -1) {
      return null
    }

    const bucketName = pathSegments[storageMarkerIndex + 2]
    const objectPath = pathSegments.slice(storageMarkerIndex + 3).join("/")

    if (bucketName !== USER_POSTS_BUCKET || !objectPath) {
      return null
    }

    return decodeURIComponent(objectPath)
  } catch {
    return trimmedReference
  }
}

/**
 * Resolve a stored post video reference into a playable URL.
 *
 * New uploads save a bucket-relative storage path, while older data may still
 * contain a bucket-prefixed path or an already signed Supabase URL. This helper
 * normalizes those legacy shapes before requesting a fresh signed URL so feed
 * and library pages can play both new and old videos reliably.
 */
export async function resolvePostVideoUrl(videoReference: string) {
  const normalizedStoragePath = normalizeUserPostStoragePath(videoReference)

  if (normalizedStoragePath === null) {
    return videoReference
  }

  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.storage
    .from(USER_POSTS_BUCKET)
    .createSignedUrl(normalizedStoragePath, 60 * 60)

  if (error) {
    throw error
  }

  return data.signedUrl
}
