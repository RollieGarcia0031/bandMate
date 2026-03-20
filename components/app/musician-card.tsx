"use client"

import { useState } from "react"
import { Heart, X, MessageCircle, Share2, Music, MapPin, Play, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MusicianCardProps {
  musician: {
    id: string
    name: string
    age: number
    location: string
    instruments: string[]
    genres: string[]
    bio: string
    imageUrl: string
    audioPreviewUrl?: string
  }
  onLike?: () => void
  onPass?: () => void
  impressionPostId?: string
}

export function MusicianCard({ musician, onLike, onPass, impressionPostId }: MusicianCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
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
      {/* Card Container */}
      <div className="relative w-full max-w-md mx-auto h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] rounded-2xl overflow-hidden bg-card">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${musician.imageUrl})`,
          }}
        >
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          {/* Info Section */}
          <div className="space-y-4">
            {/* Name and Age */}
            <div className="flex items-end gap-3">
              <h2 className="text-3xl font-bold text-foreground">{musician.name}</h2>
              <span className="text-2xl text-muted-foreground">{musician.age}</span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{musician.location}</span>
            </div>

            {/* Instruments */}
            <div className="flex flex-wrap gap-2">
              {musician.instruments.map((instrument) => (
                <span
                  key={instrument}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary"
                >
                  {instrument}
                </span>
              ))}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {musician.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground"
                >
                  {genre}
                </span>
              ))}
            </div>

            {/* Bio */}
            <p className="text-sm text-muted-foreground line-clamp-3">
              {musician.bio}
            </p>

            {/* Audio Preview */}
            {musician.audioPreviewUrl && (
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary/80 backdrop-blur-sm hover:bg-secondary transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary">
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-primary-foreground" />
                  ) : (
                    <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">Listen to my sound</p>
                  <p className="text-xs text-muted-foreground">Demo track - 0:30</p>
                </div>
                <Music className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Side Actions */}
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

      {/* Bottom Action Buttons (Desktop) */}
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
