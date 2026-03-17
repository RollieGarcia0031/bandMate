"use client"

import { Settings, Edit, Music, MapPin, Calendar, Share2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Mock user data - will be replaced with Supabase auth
const mockUser = {
  name: "Jamie Wilson",
  username: "@jamiewilson",
  age: 27,
  location: "San Francisco, CA",
  joinedDate: "March 2024",
  bio: "Multi-instrumentalist and producer. Always looking for new sounds and collaborations. Let's make something beautiful together.",
  instruments: ["Guitar", "Piano", "Production"],
  genres: ["Indie", "Electronic", "Alternative"],
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop",
  stats: {
    matches: 24,
    likes: 156,
    tracks: 8,
  },
}

export default function MePage() {
  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="relative">
        {/* Cover Image */}
        <div 
          className="h-40 lg:h-56 bg-cover bg-center"
          style={{
            backgroundImage: "url(https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&h=400&fit=crop)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Settings Button */}
        <Link
          href="/me/settings"
          className="absolute top-4 right-4 p-2 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-colors"
        >
          <Settings className="w-5 h-5 text-foreground" />
        </Link>

        {/* Avatar */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
          <div
            className="w-32 h-32 rounded-full bg-cover bg-center border-4 border-background"
            style={{ backgroundImage: `url(${mockUser.avatar})` }}
          />
        </div>
      </div>

      {/* Profile Content */}
      <div className="mt-20 px-4 lg:px-8 max-w-2xl mx-auto">
        {/* Name and Username */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">{mockUser.name}, {mockUser.age}</h1>
          <p className="text-muted-foreground">{mockUser.username}</p>
        </div>

        {/* Location and Joined */}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{mockUser.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>Joined {mockUser.joinedDate}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-card mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{mockUser.stats.matches}</p>
            <p className="text-sm text-muted-foreground">Matches</p>
          </div>
          <div className="text-center border-x border-border">
            <p className="text-2xl font-bold text-foreground">{mockUser.stats.likes}</p>
            <p className="text-sm text-muted-foreground">Likes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{mockUser.stats.tracks}</p>
            <p className="text-sm text-muted-foreground">Tracks</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-8">
          <Button className="flex-1 h-12" variant="default">
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
          <Button className="h-12" variant="outline">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Bio */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-foreground">About</h2>
          <p className="text-muted-foreground">{mockUser.bio}</p>
        </div>

        {/* Instruments */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Instruments
          </h2>
          <div className="flex flex-wrap gap-2">
            {mockUser.instruments.map((instrument) => (
              <span
                key={instrument}
                className="px-4 py-2 rounded-full bg-primary/20 text-primary text-sm font-medium"
              >
                {instrument}
              </span>
            ))}
          </div>
        </div>

        {/* Genres */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-foreground">Genres</h2>
          <div className="flex flex-wrap gap-2">
            {mockUser.genres.map((genre) => (
              <span
                key={genre}
                className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>

        {/* Logout Button */}
        <Button variant="outline" className="w-full h-12 text-destructive hover:text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  )
}
