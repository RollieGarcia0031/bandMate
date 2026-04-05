"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, Phone, Video, MoreVertical, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { getOrCreateConversation, getConversationMessages, sendMessage, getChatPartner } from "../actions"
import { resolveProfilePhotoUrl } from "@/lib/supabase/storage-cache-control"

// Message interfaces
interface Message {
  id: string
  text: string
  sender: "you" | "them"
  timestamp: string
}

interface ChatUserInfo {
  id: string
  name: string
  avatar: string
  status: string
  uploadedAt: string | null
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [chatPartner, setChatPartner] = useState<ChatUserInfo | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createSupabaseBrowserClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    void initChat()
  }, [id])

  useEffect(() => {
    if (!conversationId) return

    // Real-time listener
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new
          setMessages((prev) => {
            // Avoid duplicates if we already added it optimistically
            if (prev.some(m => m.id === newMessage.id)) return prev;
            
            const mappedMessage: Message = {
              id: newMessage.id,
              text: newMessage.content,
              sender: (newMessage.sender_id === currentUserId ? "you" : "them") as "you" | "them",
              timestamp: new Date(newMessage.sent_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              })
            }
            return [...prev, mappedMessage]
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId])

  async function initChat() {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // 1. Get/Create Conversation
      const convId = await getOrCreateConversation(id)
      setConversationId(convId)

      // 2. Load History
      const dbMessages = await getConversationMessages(convId)
      const mapped: Message[] = dbMessages.map((m: any) => ({
        id: m.id,
        text: m.content,
        sender: (m.sender_id === user.id ? "you" : "them") as "you" | "them",
        timestamp: new Date(m.sent_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      }))
      setMessages(mapped)

      // 3. Load Chat Partner Info
      const partner = await getChatPartner(id, user.id)
      if (partner) {
        let avatarUrl = "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=100&h=100&fit=crop"

        if (partner.avatar) {
          avatarUrl = resolveProfilePhotoUrl(supabase, partner.avatar, partner.uploadedAt)
        }
        setChatPartner({
          ...partner,
          avatar: avatarUrl,
          status: "Recently active"
        })
      }

    } catch (err) {
      console.error("Chat init error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !conversationId || !currentUserId || isSending) return

    setIsSending(true)
    const text = input
    setInput("")

    // Optimistic Update
    const tempId = `temp-${Date.now()}`
    const optimisticMessage: Message = {
      id: tempId,
      text: text,
      sender: "you",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
    setMessages((prev) => [...prev, optimisticMessage])

    try {
      const realMessage = await sendMessage(conversationId, currentUserId, text)
      // Replace optimistic message with the real one to ensure id is correct
      setMessages((prev) => prev.map(m => m.id === tempId ? {
        ...m,
        id: realMessage.id,
        timestamp: new Date(realMessage.sent_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      } : m))
    } catch (err) {
      console.error("Send error:", err)
      setInput(text)
      setMessages((prev) => prev.filter(m => m.id !== tempId)) // Remove on failure
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="h-[calc(100dvh-5rem)] lg:h-[100dvh] flex flex-col bg-background overflow-hidden relative">
      {/* Header */}
      <div className="z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 pb-4 mt-4 lg:px-6 flex items-center justify-between safe-area-pt">
        <div className="flex items-center gap-4 flex-1">
          <Link
            href="/inbox"
            className="lg:hidden p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="flex-1 min-w-0">
            {chatPartner && (
              <>
                <div
                  className="w-10 h-10 rounded-full bg-cover bg-center inline-block mr-3"
                  style={{ backgroundImage: `url(${chatPartner.avatar})` }}
                />
                <div className="inline-block align-middle">
                  <h2 className="font-semibold text-foreground">{chatPartner.name}</h2>
                  <p className="text-xs text-muted-foreground">{chatPartner.status}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <Phone className="w-5 h-5 text-foreground" />
          </button>
          <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <Video className="w-5 h-5 text-foreground" />
          </button>
          <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <MoreVertical className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6 lg:px-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
            <p className="text-muted-foreground">No messages yet.</p>
            <p className="text-sm text-muted-foreground/60">Send a message to start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "you" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs lg:max-w-sm px-4 py-2 rounded-2xl ${
                  message.sender === "you"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-secondary text-foreground rounded-bl-none"
                }`}
              >
                <p className="break-words">{message.text}</p>
                <span className="text-xs mt-1 block opacity-70">{message.timestamp}</span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-background px-4 py-4 lg:px-6 safe-area-pb">
        <form onSubmit={handleSendMessage} className="flex items-end gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
            disabled={isLoading || isSending}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isSending}
            className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  )
}
