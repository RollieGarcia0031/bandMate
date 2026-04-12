"use client"

import { useEffect, useState } from "react"
import { MessageCircle, Music2, Heart, Loader2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { resolveProfilePhotoUrl } from "@/lib/supabase/storage-cache-control"
import { getMatchesTotalCount, getTheyLikedYouCounts, getUserConversations } from "./actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ConversationItem = {
  id: string
  matchId: string
  name: string
  lastMessage: string
  timestamp: string
  relativeTime: string
  unread: boolean
  avatar: string
  uploadedAt: string | null
}

// Matches will be fetched from Supabase
type MatchItem = {
  id: string
  name: string
  avatar: string
  theyLikedYou: number
  youLikedThem: number
  isNew: boolean
}

type TabType = "messages" | "matches"

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<TabType>("messages")
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [matchesTotalCount, setMatchesTotalCount] = useState(0)
  const [isLoadingMatches, setIsLoadingMatches] = useState(true)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [matchSortBy, setMatchSortBy] = useState<"theyLikedYou" | "youLikedThem">("theyLikedYou")

  const sortedMatches = [...matches].sort((a, b) => {
    if (matchSortBy === "theyLikedYou") {
      if (b.theyLikedYou !== a.theyLikedYou) return b.theyLikedYou - a.theyLikedYou
      return b.youLikedThem - a.youLikedThem
    } else {
      if (b.youLikedThem !== a.youLikedThem) return b.youLikedThem - a.youLikedThem
      return b.theyLikedYou - a.theyLikedYou
    }
  })

  useEffect(() => {
    void loadMatches()
    void loadMatchesTotalCount()
    void loadConversations()
  }, [])

  /**
   * Loads the user's matches from the database, fetches the profile details,
   * and dynamically calculates bidirectional video like statistics.
   */
  async function loadMatches() {
    setIsLoadingMatches(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Fetch matches where the current user is either user1 or user2
      const { data: userMatches, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("created_at", { ascending: false })

      if (matchesError) throw matchesError

      if (!userMatches || userMatches.length === 0) {
        setMatches([])
        return
      }

      // 2. Identify the "other" user IDs and map them to the match ID
      const matchedUserIds = userMatches.map(m => m.user1_id === user.id ? m.user2_id : m.user1_id)
      const matchMap = new Map()
      userMatches.forEach(m => {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id
        // In a full app, we might check a last_viewed timestamp to set isNew
        matchMap.set(otherId, { matchId: m.id, isNew: false })
      })

      // 3. Fetch the profiles and their primary photos for these matched users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id, 
          display_name,
          profile_photos(url, order)
        `)
        .in("id", matchedUserIds)

      if (profilesError) {
        console.error("Profiles fetch error:", profilesError)
      }

      // 5. Calculate "theyLikedYou"
      // They (matched users) are the swipers, you (logged-in user) are the post owner
      // We use a Server Action to fetch this because the row level security
      // restricts queries on `swipes` to the swiper. The admin service
      // bypasses this so we can see who correctly liked the current user's posts.
      const theyLikedYouData = await getTheyLikedYouCounts(matchedUserIds, user.id)

      const theyLikedYouCounts = new Map<string, number>()
      theyLikedYouData?.forEach((row: any) => {
        theyLikedYouCounts.set(row.user_id, (theyLikedYouCounts.get(row.user_id) || 0) + 1)
      })

      // 6. Calculate "youLikedThem"
      // You (logged-in user) are the swiper, they (matched users) are the post owners
      const { data: youLikedThemData } = await supabase
        .from("swipes")
        .select(`
          posts!inner ( user_id )
        `)
        .eq("user_id", user.id)
        .eq("direction", "like")
        .in("posts.user_id", matchedUserIds)

      const youLikedThemCounts = new Map<string, number>()
      youLikedThemData?.forEach((row: any) => {
        const postOwnerId = row.posts.user_id
        youLikedThemCounts.set(postOwnerId, (youLikedThemCounts.get(postOwnerId) || 0) + 1)
      })

      // 7. Assemble the final MatchItem array for the UI
      const assembledMatches: MatchItem[] = (profilesData || []).map(profile => {
        // Evaluate the embedded related profile_photos array
        const userPhotos = profile.profile_photos || []
        // Sort safely accounting for any potential type mismatches
        userPhotos.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        const pPhoto = userPhotos[0]

        const matchInfo = matchMap.get(profile.id)

        let avatarUrl = "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=100&h=100&fit=crop"
        if (pPhoto?.url) {
          avatarUrl = resolveProfilePhotoUrl(supabase, pPhoto.url)
        }

        return {
          id: matchInfo.matchId,
          name: profile.display_name,
          avatar: avatarUrl,
          theyLikedYou: theyLikedYouCounts.get(profile.id) || 0,
          youLikedThem: youLikedThemCounts.get(profile.id) || 0,
          isNew: matchInfo.isNew
        }
      })

      setMatches(assembledMatches)

    } catch (error) {
      console.error("Error loading matches:", error)
    } finally {
      setIsLoadingMatches(false)
    }
  }

  async function loadMatchesTotalCount() {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const totalCount = await getMatchesTotalCount(user.id)
      setMatchesTotalCount(totalCount)
    } catch (error) {
      console.error("Error loading matches total count:", error)
      setMatchesTotalCount(0)
    }
  }

  async function loadConversations() {
    setIsLoadingConversations(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const data = await getUserConversations(user.id)
      
      // Resolve avatar URLs
      const mapped: ConversationItem[] = (data || []).map((conv: any) => {
        let avatarUrl = "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=100&h=100&fit=crop"

        if (conv.avatar) {
          avatarUrl = resolveProfilePhotoUrl(supabase, conv.avatar, conv.uploadedAt)
        }
        return {
          ...conv,
          avatar: avatarUrl
        }
      })

      setConversations(mapped)
    } catch (error) {
      console.error("Error loading conversations:", error)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 lg:p-6 safe-area-pt">
        <h1 className="text-2xl font-bold text-foreground mb-4">Inbox</h1>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("messages")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
              activeTab === "messages"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className="w-4 h-4" />
            Messages
          </button>
          <button
            onClick={() => setActiveTab("matches")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
              activeTab === "matches"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart className="w-4 h-4" />
            Matches ({matchesTotalCount})
          </button>
        </div>
      </div>

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <>
          {/* New Matches Preview */}
          {matches.filter((m) => m.isNew).length > 0 && (
            <div className="p-4 lg:p-6 border-b border-border">
              <h2 className="text-sm font-semibold text-muted-foreground mb-4">NEW MATCHES</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {matches
                  .filter((m) => m.isNew)
                  .map((match) => (
                    <Link
                      key={match.id}
                      href={`/inbox/${match.id}`}
                      className="flex flex-col items-center gap-2 min-w-[72px]"
                    >
                      <div className="relative">
                        <div
                          className="w-16 h-16 rounded-full bg-cover bg-center ring-2 ring-primary"
                          style={{ backgroundImage: `url(${match.avatar})` }}
                        />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Music2 className="w-3 h-3 text-primary-foreground" />
                        </div>
                      </div>
                      <span className="text-sm text-foreground">{match.name.split(" ")[0]}</span>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* Conversations */}
          <div className="divide-y divide-border">
            {isLoadingConversations ? (
              <div className="flex justify-center items-center py-20 px-4">
                <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
              </div>
            ) : conversations.length > 0 ? (
              conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/inbox/${conversation.matchId}`}
                  className="flex items-center gap-4 p-4 lg:p-6 hover:bg-card/50 transition-colors"
                >
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${conversation.avatar})` }}
                    />
                    {conversation.unread && (
                      <div className="absolute top-0 right-0 w-3 h-3 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3
                        className={cn(
                          "font-semibold truncate",
                          conversation.unread
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {conversation.name}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {conversation.relativeTime || conversation.timestamp}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm truncate",
                        conversation.unread
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {conversation.lastMessage}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <MessageCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No messages yet
                </h3>
                <p className="text-muted-foreground text-center">
                  When you match with musicians, your conversations will appear here
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Matches Tab */}
      {activeTab === "matches" && (
        <div className="flex flex-col">
          {matches.length > 0 && !isLoadingMatches && (
            <div className="flex justify-end p-4 border-b border-border">
              <Select value={matchSortBy} onValueChange={(val: "theyLikedYou" | "youLikedThem") => setMatchSortBy(val)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="theyLikedYou">Sort by: Liked you</SelectItem>
                  <SelectItem value="youLikedThem">Sort by: You liked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="divide-y divide-border">
            {isLoadingMatches ? (
              <div className="flex justify-center items-center py-20 px-4">
                <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
              </div>
            ) : sortedMatches.length > 0 ? (
              sortedMatches.map((match) => (
              <Link
                key={match.id}
                href={`/inbox/${match.id}`}
                className="flex items-center gap-4 p-4 lg:p-6 hover:bg-card/50 transition-colors"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-14 h-14 rounded-full bg-cover bg-center ring-2 ring-border"
                    style={{ backgroundImage: `url(${match.avatar})` }}
                  />
                  {match.isNew && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-foreground">!</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {match.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {match.isNew ? "New match" : "Matched"}
                  </p>
                </div>

                {/* Like counts */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-primary mb-1">
                      <Heart className="w-4 h-4 fill-current" />
                      <span className="font-bold text-lg">{match.theyLikedYou}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">liked you</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-accent mb-1">
                      <Heart className="w-4 h-4 fill-current" />
                      <span className="font-bold text-lg">{match.youLikedThem}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">you liked</p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-muted-foreground ml-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Heart className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No matches yet
              </h3>
              <p className="text-muted-foreground text-center">
                Start swiping on the feed to find and match with musicians
              </p>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  )
}
