import { revalidateTag, unstable_cache } from "next/cache"

type CacheKeyPart = string | number | boolean | null | undefined

function normalizeCacheKeyPart(part: CacheKeyPart) {
  if (part === null || part === undefined) {
    return ""
  }

  return String(part)
}

export const cacheKeys = {
  profile: (userId: string) => ["profile", normalizeCacheKeyPart(userId)],
  conversations: (userId: string) => ["conversations", normalizeCacheKeyPart(userId)],
  messages: (conversationId: string) => ["messages", normalizeCacheKeyPart(conversationId)],
} as const

export const cacheTags = {
  profile: (userId: string) => `profile:${userId}`,
  conversations: (userId: string) => `conversations:${userId}`,
  messages: (conversationId: string) => `messages:${conversationId}`,
} as const

export function runCachedQuery<T>(
  keyParts: CacheKeyPart[],
  tags: string[],
  query: () => Promise<T>,
): Promise<T> {
  return unstable_cache(query, keyParts.map(normalizeCacheKeyPart), { tags })()
}

export function revalidateProfileTag(userId: string) {
  revalidateTag(cacheTags.profile(userId), "max")
}

export function revalidateConversationsTag(userId: string) {
  revalidateTag(cacheTags.conversations(userId), "max")
}

export function revalidateMessagesTag(conversationId: string) {
  revalidateTag(cacheTags.messages(conversationId), "max")
}
