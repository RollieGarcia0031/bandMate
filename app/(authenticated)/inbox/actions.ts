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

/**
 * Gets or creates a conversation for a given match.
 */
export async function getOrCreateConversation(matchId: string) {
  const supabase = createSupabaseAdminClient()

  // Try to find existing conversation
  const { data: existing, error: fetchError } = await supabase
    .from("conversations")
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle()

  if (existing) return existing.id

  // Create new if not found
  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ match_id: matchId })
    .select("id")
    .single()

  if (createError) {
    console.error("Error creating conversation:", createError)
    throw createError
  }

  return created.id
}

/**
 * Fetches message history for a conversation.
 */
export async function getConversationMessages(conversationId: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })

  if (error) {
    console.error("Error fetching messages:", error)
    return []
  }

  return data
}

/**
 * Sends a new message.
 */
export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content
    })
    .select()
    .single()

  if (error) {
    console.error("Error sending message:", error)
    throw error
  }

  return data
}

/**
 * Gets the chat partner's profile information.
 */
export async function getChatPartner(matchId: string, currentUserId: string) {
  const supabase = createSupabaseAdminClient()

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("user1_id, user2_id")
    .eq("id", matchId)
    .single()

  if (matchError || !match) return null

  const partnerId = match.user1_id === currentUserId ? match.user2_id : match.user1_id

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, id")
    .eq("id", partnerId)
    .single()

  const { data: photo } = await supabase
    .from("profile_photos")
    .select("url, uploaded_at")
    .eq("user_id", partnerId)
    .order("order", { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    id: partnerId,
    name: profile?.display_name || "Musician",
    avatar: photo?.url || "",
    uploadedAt: photo?.uploaded_at || null
  }
}

/**
 * Fetches all conversations where the user is a participant.
 */
export async function getUserConversations(currentUserId: string) {
  const supabase = createSupabaseAdminClient()

  // 1. Fetch conversations joined with matches and profiles
  // We need to find matches where user is user1 or user2
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      match_id,
      matches!inner (
        id,
        user1_id,
        user2_id
      )
    `)
    .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`, { foreignTable: "matches" })

  if (error) {
    console.error("Error fetching conversations:", error)
    return []
  }

  // 2. Hydrate with latest messages and partner profile info
  const hydratedConversations = await Promise.all(data.map(async (conv: any) => {
    const partnerId = conv.matches.user1_id === currentUserId ? conv.matches.user2_id : conv.matches.user1_id

    // Fetch latest message
    const { data: latestMsg } = await supabase
      .from("messages")
      .select("content, sent_at, read_at, sender_id")
      .eq("conversation_id", conv.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch partner profile & photo
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", partnerId)
      .single()

    const { data: photo } = await supabase
      .from("profile_photos")
      .select("url, uploaded_at")
      .eq("user_id", partnerId)
      .order("order", { ascending: true })
      .limit(1)
      .maybeSingle()

    return {
      id: conv.id,
      matchId: conv.match_id,
      name: profile?.display_name || "Musician",
      avatar: photo?.url || "",
      uploadedAt: photo?.uploaded_at || null,
      lastMessage: latestMsg?.content || "No messages yet",
      timestamp: latestMsg?.sent_at ? new Date(latestMsg.sent_at).toLocaleDateString() : 'N/A',
      relativeTime: latestMsg?.sent_at ? formatRelativeTime(new Date(latestMsg.sent_at)) : '',
      unread: latestMsg ? (!latestMsg.read_at && latestMsg.sender_id !== currentUserId) : false,
      rawTimestamp: latestMsg?.sent_at || '0'
    }
  }))

  // Sort by latest message date
  return hydratedConversations.sort((a, b) => 
    new Date(b.rawTimestamp).getTime() - new Date(a.rawTimestamp).getTime()
  )
}

function formatRelativeTime(date: Date) {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)
  
  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d ago`
}
