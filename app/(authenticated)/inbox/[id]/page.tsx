"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Phone, Video, MoreVertical, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface Message {
  id: string
  text: string
  sender: "you" | "them"
  timestamp: string
}

// Mock data - will be replaced with Supabase
const mockMessages: Message[] = [
  {
    id: "1",
    text: "Hey! I loved your profile, we should jam sometime",
    sender: "them",
    timestamp: "2:30 PM",
  },
  {
    id: "2",
    text: "Thanks! That would be awesome. What kind of music do you usually play?",
    sender: "you",
    timestamp: "2:35 PM",
  },
  {
    id: "3",
    text: "Mainly indie rock and some alternative. I play guitar and produce beats",
    sender: "them",
    timestamp: "2:40 PM",
  },
  {
    id: "4",
    text: "That's cool! I do vocals and some synth work. We could create something really interesting together",
    sender: "you",
    timestamp: "2:45 PM",
  },
  {
    id: "5",
    text: "Definitely! Want to exchange some of your work? I'd love to hear what you've got",
    sender: "them",
    timestamp: "2:50 PM",
  },
]

const mockUser = {
  id: "5",
  name: "Riley Johnson",
  avatar: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=100&h=100&fit=crop",
  status: "Active now",
}

export default function ChatPage({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<Message[]>(mockMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    setIsLoading(true)

    // Simulate sending message
    const newMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: "you",
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    setMessages([...messages, newMessage])
    setInput("")

    // Simulate receiving response after delay
    setTimeout(() => {
      const mockResponse: Message = {
        id: Date.now().toString(),
        text: "That's awesome! Let's set up a time to collaborate soon.",
        sender: "them",
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
      setMessages((prev) => [...prev, mockResponse])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-4 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <Link
            href="/inbox"
            className="lg:hidden p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-full bg-cover bg-center inline-block mr-3"
              style={{ backgroundImage: `url(${mockUser.avatar})` }}
            />
            <div className="inline-block">
              <h2 className="font-semibold text-foreground">{mockUser.name}</h2>
              <p className="text-xs text-muted-foreground">{mockUser.status}</p>
            </div>
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
        {messages.map((message) => (
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
        ))}
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
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
