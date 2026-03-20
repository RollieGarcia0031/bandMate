"use client"

import { useEffect } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

const FEED_IMPRESSION_SELECTOR = "[data-feed-post-id]"
const FEED_IMPRESSION_SESSION_KEY = "feed-impression-session-id"
const DEFAULT_DWELL_MS = 1500
const DEFAULT_INTERSECTION_RATIO = 0.6
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type UseFeedImpressionTrackerOptions = {
  dwellMs?: number
  minIntersectionRatio?: number
  source?: string
}

function getFeedImpressionSessionId() {
  if (typeof window === "undefined") {
    return crypto.randomUUID()
  }

  const existingSessionId = window.sessionStorage.getItem(FEED_IMPRESSION_SESSION_KEY)
  if (existingSessionId) {
    return existingSessionId
  }

  const sessionId = crypto.randomUUID()
  window.sessionStorage.setItem(FEED_IMPRESSION_SESSION_KEY, sessionId)
  return sessionId
}

/**
 * Observe /feed cards and write a first-seen impression only after the card has
 * remained at least 60% visible for 1.5 seconds. The selector-based approach
 * keeps the hook reusable as the feed evolves from mocked data to live posts.
 */
export function useFeedImpressionTracker({
  dwellMs = DEFAULT_DWELL_MS,
  minIntersectionRatio = DEFAULT_INTERSECTION_RATIO,
  source = "feed",
}: UseFeedImpressionTrackerOptions = {}) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return
    }

    const supabase = createSupabaseBrowserClient()
    const loggedPostIds = new Set<string>()
    const pendingTimers = new Map<string, number>()
    const sessionId = getFeedImpressionSessionId()
    let cancelled = false
    const authenticatedUserIdPromise = supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        return null
      }

      return data.user?.id ?? null
    })

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const postId = entry.target.getAttribute("data-feed-post-id")?.trim()
          if (!postId || !UUID_PATTERN.test(postId)) {
            continue
          }

          const existingTimer = pendingTimers.get(postId)
          const isMeaningfullyVisible = entry.isIntersecting && entry.intersectionRatio >= minIntersectionRatio

          if (!isMeaningfullyVisible) {
            if (existingTimer) {
              window.clearTimeout(existingTimer)
              pendingTimers.delete(postId)
            }
            continue
          }

          if (loggedPostIds.has(postId) || existingTimer) {
            continue
          }

          const timerId = window.setTimeout(() => {
            pendingTimers.delete(postId)

            void authenticatedUserIdPromise.then((authenticatedUserId) => {
              if (cancelled || loggedPostIds.has(postId) || !authenticatedUserId) {
                return
              }

              return supabase
                .from("feed_impressions")
                .insert({
                  user_id: authenticatedUserId,
                  post_id: postId,
                  dwell_ms: dwellMs,
                  session_id: sessionId,
                  source,
                })
                .then(({ error }) => {
                  if (!error || error.code === "23505") {
                    loggedPostIds.add(postId)
                    return
                  }

                  console.error("Failed to write feed impression", error)
                })
            })
          }, dwellMs)

          pendingTimers.set(postId, timerId)
        }
      },
      {
        threshold: [0, minIntersectionRatio, 1],
      }
    )

    const elements = Array.from(document.querySelectorAll(FEED_IMPRESSION_SELECTOR))
    elements.forEach((element) => observer.observe(element))

    return () => {
      cancelled = true
      observer.disconnect()
      pendingTimers.forEach((timerId) => window.clearTimeout(timerId))
      pendingTimers.clear()
    }
  }, [dwellMs, minIntersectionRatio, source])
}
