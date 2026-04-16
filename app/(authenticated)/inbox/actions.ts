"use server";

import {
  cacheKeys,
  cacheTags,
  revalidateConversationsTag,
  revalidateMatchesTag,
  revalidateMessagesTag,
  runCachedQuery,
} from "@/lib/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Server action to get the swipes from matched users targeting the logged-in user's posts.
 * We use the admin client here because the RLS policy on the swipes table currently
 * restricts querying to only the swipes made by the logged-in user themselves, which
 * prevents standard client-side queries from determining how many times other users
 * liked the current user's posts.
 */
export async function getTheyLikedYouCounts(
  matchedUserIds: string[],
  currentUserId: string,
) {
  if (!matchedUserIds || matchedUserIds.length === 0) {
    return [];
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from("swipes")
    .select(`
      user_id,
      posts!inner ( user_id )
    `)
    .in("user_id", matchedUserIds)
    .eq("direction", "like")
    .eq("posts.user_id", currentUserId);

  if (error) {
    console.error("error fetching theyLikedYouData via admin", error);
    return [];
  }

  return data || [];
}

/**
 * Fetches the total number of matches for a user.
 * Uses count-only mode so the caller can display an accurate total
 * independent from any paginated list query.
 */
export async function getMatchesTotalCount(currentUserId: string) {
  const supabase = createSupabaseAdminClient();

  const { count, error } = await supabase
    .from("matches")
    .select("id", { head: true, count: "exact" })
    .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

  if (error) {
    console.error("Error fetching matches total count:", error);
    return 0;
  }

  return count ?? 0;
}

type MatchSortOption = "theyLikedYou" | "youLikedThem";

export type MatchItem = {
  id: string;
  name: string;
  avatar: string;
  uploadedAt: string | null;
  isNew: boolean;
};

export type MatchesPagePayload = {
  items: MatchItem[];
  page: number;
  pageSize: number;
  nextPage?: number;
};

export async function getMatchesPage(
  currentUserId: string,
  page = 1,
  pageSize = 25,
  sort: MatchSortOption = "theyLikedYou",
) {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.min(100, Math.floor(pageSize)));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  return runCachedQuery(
    cacheKeys.matches(currentUserId, safePage, safePageSize, sort),
    [cacheTags.matches(currentUserId)],
    async (): Promise<MatchesPagePayload> => {
      const supabase = createSupabaseAdminClient();

      const { data: userMatches, error: matchesError } = await supabase
        .from("matches")
        .select("id, user1_id, user2_id")
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

      if (matchesError) {
        console.error("Error fetching paginated matches:", matchesError);
        return { items: [], page: safePage, pageSize: safePageSize };
      }

      if (!userMatches || userMatches.length === 0) {
        return { items: [], page: safePage, pageSize: safePageSize };
      }

      const matchedUserIds = userMatches.map((match) =>
        match.user1_id === currentUserId ? match.user2_id : match.user1_id,
      );

      const matchMap = new Map(
        userMatches.map((match) => {
          const otherId =
            match.user1_id === currentUserId ? match.user2_id : match.user1_id;
          return [otherId, { matchId: match.id, isNew: false }];
        }),
      );

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(
          `
          id,
          display_name,
          profile_photos(url, order, uploaded_at)
        `,
        )
        .in("id", matchedUserIds);

      if (profilesError) {
        console.error("Profiles fetch error:", profilesError);
      }

      const assembledMatches = (profilesData || []).map((profile: any) => {
        const userPhotos = [...(profile.profile_photos || [])];
        userPhotos.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        const primaryPhoto = userPhotos[0];
        const matchInfo = matchMap.get(profile.id);

        return {
          id: matchInfo?.matchId || profile.id,
          name: profile.display_name || "Musician",
          avatar: primaryPhoto?.url || "",
          uploadedAt: primaryPhoto?.uploaded_at || null,
          isNew: matchInfo?.isNew ?? false,
        };
      });

      const items = assembledMatches;

      return {
        items,
        page: safePage,
        pageSize: safePageSize,
        nextPage: items.length === safePageSize ? safePage + 1 : undefined,
      };
    },
  );
}

export type MatchCountsById = Record<
  string,
  { theyLikedYou: number; youLikedThem: number }
>;

export async function getMatchCountsForMatchIds(
  currentUserId: string,
  matchIds: string[],
): Promise<MatchCountsById> {
  if (!matchIds?.length) return {};

  const supabase = createSupabaseAdminClient();

  const { data: userMatches, error: matchesError } = await supabase
    .from("matches")
    .select("id, user1_id, user2_id")
    .in("id", matchIds)
    .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

  if (matchesError || !userMatches?.length) {
    if (matchesError) {
      console.error("Error fetching matches for batched counts:", matchesError);
    }
    return {};
  }

  const matchedUserIds = userMatches.map((match) =>
    match.user1_id === currentUserId ? match.user2_id : match.user1_id,
  );
  const matchedUserIdByMatchId = new Map(
    userMatches.map((match) => [
      match.id,
      match.user1_id === currentUserId ? match.user2_id : match.user1_id,
    ]),
  );

  const theyLikedYouData = await getTheyLikedYouCounts(matchedUserIds, currentUserId);
  const theyLikedYouByUserId = new Map<string, number>();
  theyLikedYouData?.forEach((row: any) => {
    theyLikedYouByUserId.set(
      row.user_id,
      (theyLikedYouByUserId.get(row.user_id) || 0) + 1,
    );
  });

  const { data: youLikedThemData, error: youLikedThemError } = await supabase
    .from("swipes")
    .select(
      `
      posts!inner ( user_id )
    `,
    )
    .eq("user_id", currentUserId)
    .eq("direction", "like")
    .in("posts.user_id", matchedUserIds);

  if (youLikedThemError) {
    console.error("Error fetching youLikedThem batched counts:", youLikedThemError);
  }

  const youLikedThemByUserId = new Map<string, number>();
  youLikedThemData?.forEach((row: any) => {
    const postOwnerId = row.posts.user_id;
    youLikedThemByUserId.set(
      postOwnerId,
      (youLikedThemByUserId.get(postOwnerId) || 0) + 1,
    );
  });

  const countMap: MatchCountsById = {};
  for (const match of userMatches) {
    const matchedUserId = matchedUserIdByMatchId.get(match.id);
    if (!matchedUserId) continue;
    countMap[match.id] = {
      theyLikedYou: theyLikedYouByUserId.get(matchedUserId) || 0,
      youLikedThem: youLikedThemByUserId.get(matchedUserId) || 0,
    };
  }

  return countMap;
}

/**
 * Gets or creates a conversation for a given match.
 */
export async function getOrCreateConversation(matchId: string) {
  const supabase = createSupabaseAdminClient();

  // Try to find existing conversation
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new if not found
  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ match_id: matchId })
    .select("id")
    .single();

  if (createError) {
    console.error("Error creating conversation:", createError);
    throw createError;
  }

  const { data: match } = await supabase
    .from("matches")
    .select("user1_id, user2_id")
    .eq("id", matchId)
    .maybeSingle();

  if (match) {
    // Ensure both participants immediately see the newly created conversation.
    revalidateConversationsTag(match.user1_id);
    revalidateConversationsTag(match.user2_id);
  }

  return created.id;
}

/**
 * Fetches message history for a conversation.
 */
export async function getConversationMessages(conversationId: string) {
  // Cache by conversation id so message history isn't refetched on every render.
  return runCachedQuery(
    cacheKeys.messages(conversationId),
    [cacheTags.messages(conversationId)],
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return [];
      }

      return data;
    },
  );
}

/**
 * Sends a new message.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error("Error sending message:", error);
    throw error;
  }

  // The new message invalidates this thread history.
  revalidateMessagesTag(conversationId);

  // The inbox list preview (last message, unread badge, ordering) changes too.
  const participantIds = await getConversationParticipantIds(conversationId);
  participantIds.forEach((participantId) => {
    revalidateConversationsTag(participantId);
  });

  return data;
}

export async function revalidateMatchesForUsers(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  uniqueUserIds.forEach((userId) => revalidateMatchesTag(userId));
}

/**
 * Gets the chat partner's profile information.
 */
export async function getChatPartner(matchId: string, currentUserId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("user1_id, user2_id")
    .eq("id", matchId)
    .single();

  if (matchError || !match) return null;

  const partnerId =
    match.user1_id === currentUserId ? match.user2_id : match.user1_id;

  // Partner identity/photo can be reused and invalidated via profile tag updates.
  return runCachedQuery(
    [...cacheKeys.profile(partnerId), "chat-partner", matchId],
    [cacheTags.profile(partnerId)],
    async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, id")
        .eq("id", partnerId)
        .single();

      const { data: photo } = await supabase
        .from("profile_photos")
        .select("url, uploaded_at")
        .eq("user_id", partnerId)
        .order("order", { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        id: partnerId,
        name: profile?.display_name || "Musician",
        avatar: photo?.url || "",
        uploadedAt: photo?.uploaded_at || null,
      };
    },
  );
}

/**
 * Fetches all conversations where the user is a participant.
 */
export async function getUserConversations(currentUserId: string) {
  // Cache the hydrated inbox list for each user and invalidate by conversations tag.
  return runCachedQuery(
    cacheKeys.conversations(currentUserId),
    [cacheTags.conversations(currentUserId)],
    async () => {
      const supabase = createSupabaseAdminClient();

      // 1. Fetch conversations joined with matches and profiles
      // We need to find matches where user is user1 or user2
      const { data, error } = await supabase
        .from("conversations")
        .select(
          `
          id,
          match_id,
          matches!inner (
            id,
            user1_id,
            user2_id
          )
        `,
        )
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`, {
          foreignTable: "matches",
        });

      if (error) {
        console.error("Error fetching conversations:", error);
        return [];
      }

      // 2. Hydrate with latest messages and partner profile info
      const hydratedConversations = await Promise.all(
        data.map(async (conv: any) => {
          const partnerId =
            conv.matches.user1_id === currentUserId
              ? conv.matches.user2_id
              : conv.matches.user1_id;

          // Fetch latest message
          const { data: latestMsg } = await supabase
            .from("messages")
            .select("content, sent_at, read_at, sender_id")
            .eq("conversation_id", conv.id)
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Fetch partner profile & photo
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", partnerId)
            .single();

          const { data: photo } = await supabase
            .from("profile_photos")
            .select("url, uploaded_at")
            .eq("user_id", partnerId)
            .order("order", { ascending: true })
            .limit(1)
            .maybeSingle();

          return {
            id: conv.id,
            matchId: conv.match_id,
            name: profile?.display_name || "Musician",
            avatar: photo?.url || "",
            uploadedAt: photo?.uploaded_at || null,
            lastMessage: latestMsg?.content || "No messages yet",
            timestamp: latestMsg?.sent_at
              ? new Date(latestMsg.sent_at).toLocaleDateString()
              : "N/A",
            relativeTime: latestMsg?.sent_at
              ? formatRelativeTime(new Date(latestMsg.sent_at))
              : "",
            unread: latestMsg
              ? !latestMsg.read_at && latestMsg.sender_id !== currentUserId
              : false,
            rawTimestamp: latestMsg?.sent_at || "0",
          };
        }),
      );

      // Sort by latest message date
      return hydratedConversations.sort(
        (a, b) =>
          new Date(b.rawTimestamp).getTime() -
          new Date(a.rawTimestamp).getTime(),
      );
    },
  );
}

async function getConversationParticipantIds(conversationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("matches!inner(user1_id,user2_id)")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data?.matches) {
    return [];
  }

  const matchRow = Array.isArray(data.matches) ? data.matches[0] : data.matches;

  if (!matchRow) {
    return [];
  }

  return [matchRow.user1_id, matchRow.user2_id].filter(
    (value): value is string => Boolean(value),
  );
}

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}
