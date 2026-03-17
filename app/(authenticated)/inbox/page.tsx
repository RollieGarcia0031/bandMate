"use client"

import { MessageCircle, Music2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// Mock conversations - will be replaced with Supabase data
const mockConversations = [
  {
    id: "1",
    name: "Alex Rivera",
    lastMessage: "That sounds great! When do you want to jam?",
    timestamp: "2m ago",
    unread: true,
    avatar: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop",
    isMatch: true,
  },
  {
    id: "2",
    name: "Maya Chen",
    lastMessage: "I listened to your demo, loved it!",
    timestamp: "1h ago",
    unread: true,
    avatar: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop",
    isMatch: false,
  },
  {
    id: "3",
    name: "Jordan Brooks",
    lastMessage: "Let me know if you need a drummer for your project",
    timestamp: "3h ago",
    unread: false,
    avatar: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=100&h=100&fit=crop",
    isMatch: false,
  },
  {
    id: "4",
    name: "Sam Taylor",
    lastMessage: "The bass line I sent, what do you think?",
    timestamp: "1d ago",
    unread: false,
    avatar: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=100&h=100&fit=crop",
    isMatch: false,
  },
]

const newMatches = [
  {
    id: "5",
    name: "Riley",
    avatar: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=100&h=100&fit=crop",
  },
  {
    id: "6",
    name: "Casey",
    avatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=100&h=100&fit=crop",
  },
  {
    id: "7",
    name: "Morgan",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
  },
]

export default function InboxPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
      </div>

      {/* New Matches */}
      {newMatches.length > 0 && (
        <div className="p-4 lg:p-6 border-b border-border">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">NEW MATCHES</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {newMatches.map((match) => (
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
                <span className="text-sm text-foreground">{match.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Conversations */}
      <div className="divide-y divide-border">
        {mockConversations.length > 0 ? (
          mockConversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/inbox/${conversation.id}`}
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
                  <h3 className={cn(
                    "font-semibold truncate",
                    conversation.unread ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {conversation.name}
                  </h3>
                  <span className="text-xs text-muted-foreground">{conversation.timestamp}</span>
                </div>
                <p className={cn(
                  "text-sm truncate",
                  conversation.unread ? "text-foreground" : "text-muted-foreground"
                )}>
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
            <h3 className="text-lg font-semibold text-foreground mb-2">No messages yet</h3>
            <p className="text-muted-foreground text-center">
              When you match with musicians, your conversations will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
