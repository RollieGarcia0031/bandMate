"use server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * Server action to get the swipes from matched users targeting the logged-in user's posts.
 * We use the admin client here because the RLS policy on the swipes table currently
 * restricts querying to only the swipes made by the logged-in user themselves, which
 * prevents standard client-side queries from determining how many times other users 
 * liked the current user's posts.
 */
export async function getTheyLikedYouCounts(matchedUserIds: string[], currentUserId: string) {
  if (!matchedUserIds || matchedUserIds.length === 0) {
    return []
  }

  const supabaseAdmin = createSupabaseAdminClient()
  
  const { data, error } = await supabaseAdmin
    .from("swipes")
    .select(`
      user_id,
      posts!inner ( user_id )
    `)
    .in("user_id", matchedUserIds)
    .eq("direction", "like")
    .eq("posts.user_id", currentUserId)

  if (error) {
    console.error("error fetching theyLikedYouData via admin", error)
    return []
  }

  return data || []
}
