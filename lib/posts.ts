import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { supabase_config } from "@/lib/supabase/config"

export type Visibility = "public" | "private" | "followers"

export type PostRow = {
  id: string
  user_id?: string
  title: string | null
  description: string | null
  visibility: Visibility | null
  video_url: string
  likes_count: number | null
  dislikes_count?: number | null
  comments_count: number | null
  created_at: string | null
}

export type PostVideoReferenceDebugInfo = {
  bucketName: string
  normalizedStoragePath: string | null
  originalReference: string
  referenceKind:
    | "empty"
    | "storage-path"
    | "bucket-prefixed-path"
    | "supabase-storage-url"
    | "external-url"
    | "invalid-url"
}

const USER_POSTS_BUCKET = supabase_config.storageBuckets.userPosts

/**
 * Inspect a persisted post video reference and describe how the app will treat
 * it before requesting a signed playback URL.
 */
export function getPostVideoReferenceDebugInfo(videoReference: string): PostVideoReferenceDebugInfo {
  const trimmedReference = videoReference.trim()
  const bucketPrefix = `${USER_POSTS_BUCKET}/`

  if (!trimmedReference) {
    return {
      bucketName: USER_POSTS_BUCKET,
      normalizedStoragePath: "",
      originalReference: videoReference,
      referenceKind: "empty",
    }
  }

  if (!/^https?:\/\//i.test(trimmedReference)) {
    return {
      bucketName: USER_POSTS_BUCKET,
      normalizedStoragePath: trimmedReference.startsWith(bucketPrefix)
        ? trimmedReference.slice(bucketPrefix.length)
        : trimmedReference,
      originalReference: videoReference,
      referenceKind: trimmedReference.startsWith(bucketPrefix) ? "bucket-prefixed-path" : "storage-path",
    }
  }

  try {
    const parsedUrl = new URL(trimmedReference)
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean)
    const storageMarkerIndex = pathSegments.indexOf("object")

    if (storageMarkerIndex === -1) {
      return {
        bucketName: USER_POSTS_BUCKET,
        normalizedStoragePath: null,
        originalReference: videoReference,
        referenceKind: "external-url",
      }
    }

    const bucketName = pathSegments[storageMarkerIndex + 2]
    const objectPath = pathSegments.slice(storageMarkerIndex + 3).join("/")

    if (bucketName !== USER_POSTS_BUCKET || !objectPath) {
      return {
        bucketName: USER_POSTS_BUCKET,
        normalizedStoragePath: null,
        originalReference: videoReference,
        referenceKind: "external-url",
      }
    }

    return {
      bucketName: USER_POSTS_BUCKET,
      normalizedStoragePath: decodeURIComponent(objectPath),
      originalReference: videoReference,
      referenceKind: "supabase-storage-url",
    }
  } catch {
    return {
      bucketName: USER_POSTS_BUCKET,
      normalizedStoragePath: trimmedReference,
      originalReference: videoReference,
      referenceKind: "invalid-url",
    }
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
export async function resolvePostVideoUrl(videoReference: string, client?: any) {
  const debugInfo = getPostVideoReferenceDebugInfo(videoReference)

  if (debugInfo.normalizedStoragePath === null) {
    return videoReference
  }

  const supabase = client || createSupabaseBrowserClient()
  const { data, error } = await supabase.storage
    .from(USER_POSTS_BUCKET)
    .createSignedUrl(debugInfo.normalizedStoragePath, 60 * 60)

  if (error) {
    throw new Error(
      [
        `Failed to resolve post video from Supabase Storage.`,
        `bucket=${debugInfo.bucketName}`,
        `referenceKind=${debugInfo.referenceKind}`,
        `originalReference=${JSON.stringify(debugInfo.originalReference)}`,
        `normalizedStoragePath=${JSON.stringify(debugInfo.normalizedStoragePath)}`,
        `supabaseError=${error.message}`,
      ].join(" "),
    )
  }

  return data.signedUrl
}
