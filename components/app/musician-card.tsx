"use client"

import { useState } from "react"
import { Heart, MessageCircle, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MusicianCardProps {
  musician: {
    id: string
    name: string
    videoTitle: string
    videoUrl: string
    likes: number
  }
  onLike?: () => void
  onPass?: () => void
  impressionPostId?: string
}

export function MusicianCard({ musician, onLike, onPass, impressionPostId }: MusicianCardProps) {
  const [liked, setLiked] = useState(false)

  const handleLike = () => {
    setLiked(true)
    onLike?.()
  }

  return (
    <div
      className="relative h-full w-full flex items-center justify-center snap-start snap-always"
      data-feed-post-id={impressionPostId}
    >
      <div className="relative w-full max-w-md mx-auto h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] rounded-2xl overflow-hidden bg-card">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={musician.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-background/10" />

        <div className="absolute inset-0 flex flex-col justify-end p-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-primary/90">{musician.name}</p>
              <h2 className="text-2xl font-semibold text-foreground">{musician.videoTitle}</h2>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-card/80 px-3 py-1.5 text-sm text-foreground backdrop-blur-sm">
              <Heart className="h-4 w-4" />
              <span>{formatLikes(musician.likes)}</span>
            </div>
          </div>
        </div>

        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-4">
          <button
            onClick={handleLike}
            className={cn(
              "flex flex-col items-center gap-1 transition-transform active:scale-90",
              liked && "text-primary"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-12 h-12 rounded-full bg-card/80 backdrop-blur-sm",
              liked && "bg-primary/20"
            )}>
              <Heart className={cn("w-6 h-6", liked && "fill-primary text-primary")} />
            </div>
            <span className="text-xs text-muted-foreground">Like</span>
          </button>

          <button className="flex flex-col items-center gap-1 transition-transform active:scale-90">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-card/80 backdrop-blur-sm">
              <MessageCircle className="w-6 h-6" />
            </div>
            <span className="text-xs text-muted-foreground">Chat</span>
          </button>

          <button className="flex flex-col items-center gap-1 transition-transform active:scale-90">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-card/80 backdrop-blur-sm">
              <Share2 className="w-6 h-6" />
            </div>
            <span className="text-xs text-muted-foreground">Share</span>
          </button>
        </div>
      </div>

      <div className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 items-center gap-6">
        <Button
          variant="outline"
          size="lg"
          onClick={onPass}
          className="w-16 h-16 rounded-full border-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="w-8 h-8" />
        </Button>
        <Button
          size="lg"
          onClick={handleLike}
          className="w-20 h-20 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Heart className={cn("w-10 h-10", liked && "fill-current")} />
        </Button>
      </div>
    </div>
  )
}

function formatLikes(likes: number) {
  return `${likes.toLocaleString()} like${likes === 1 ? "" : "s"}`
}
