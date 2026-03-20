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
 * Resolve a stored post video reference into a playable URL.
 *
 * New uploads save a bucket-relative storage path, while older data may still
 * contain a full URL. This helper supports both formats so feed and library
 * pages can share the same playback logic during the transition.
 */
export async function resolvePostVideoUrl(videoReference: string) {
  if (/^https?:\/\//i.test(videoReference)) {
    return videoReference
  }

  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.storage
    .from(USER_POSTS_BUCKET)
    .createSignedUrl(videoReference, 60 * 60)

  if (error) {
    throw error
  }

  return data.signedUrl
}
