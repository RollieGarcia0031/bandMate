import { revalidateTag, unstable_cache } from "next/cache"

type CacheKeyPart = string | number | boolean | null | undefined

function normalizeCacheKeyPart(part: CacheKeyPart) {
  if (part === null || part === undefined) {
    return ""
  }

  return String(part)
}

export const cacheKeys = {
  /**
   * Key prefix for user profile reads.
   * Final key shape: ["profile", userId]
   */
  profile: (userId: string) => ["profile", normalizeCacheKeyPart(userId)],
  /**
   * Key prefix for a user's inbox conversation list.
   * Final key shape: ["conversations", userId]
   */
  conversations: (userId: string) => ["conversations", normalizeCacheKeyPart(userId)],
  /**
   * Key prefix for message history in a conversation.
   * Final key shape: ["messages", conversationId]
   */
  messages: (conversationId: string) => ["messages", normalizeCacheKeyPart(conversationId)],
  /**
   * Key prefix for paginated match-list reads.
   * Final key shape: ["matches", userId, page, sort]
   */
  matches: (userId: string, page: number, sort: string) => [
    "matches",
    normalizeCacheKeyPart(userId),
    normalizeCacheKeyPart(page),
    normalizeCacheKeyPart(sort),
  ],
} as const

export const cacheTags = {
  profile: (userId: string) => `profile:${userId}`,
  conversations: (userId: string) => `conversations:${userId}`,
  messages: (conversationId: string) => `messages:${conversationId}`,
  matches: (userId: string) => `matches:${userId}`,
} as const

export function runCachedQuery<T>(
  keyParts: CacheKeyPart[],
  tags: string[],
  query: () => Promise<T>,
): Promise<T> {
  /**
   * Keep this wrapper intentionally tiny so callers can opt into caching
   * without repeating key normalization and options wiring.
   */
  return unstable_cache(query, keyParts.map(normalizeCacheKeyPart), { tags })()
}

export function revalidateProfileTag(userId: string) {
  // "max" follows Next's recommended profile for tag invalidation behavior.
  revalidateTag(cacheTags.profile(userId), "max")
}

export function revalidateConversationsTag(userId: string) {
  revalidateTag(cacheTags.conversations(userId), "max")
}

export function revalidateMessagesTag(conversationId: string) {
  revalidateTag(cacheTags.messages(conversationId), "max")
}

export function revalidateMatchesTag(userId: string) {
  revalidateTag(cacheTags.matches(userId), "max")
}
