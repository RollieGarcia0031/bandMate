"use client"

import { MusicianCard } from "@/components/app/musician-card"

// Mock data - will be replaced with Supabase data
const mockMusicians = [
  {
    id: "1",
    name: "Alex Rivera",
    age: 28,
    location: "Los Angeles, CA",
    instruments: ["Guitar", "Vocals"],
    genres: ["Rock", "Indie", "Alternative"],
    bio: "Lead guitarist looking for a band that's ready to tour. 10 years of experience playing everything from small clubs to festival stages. Let's make some noise!",
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop",
    audioPreviewUrl: "/demo.mp3",
  },
  {
    id: "2",
    name: "Maya Chen",
    age: 24,
    location: "Brooklyn, NY",
    instruments: ["Piano", "Synth", "Production"],
    genres: ["Electronic", "Pop", "R&B"],
    bio: "Producer and keys player with a home studio setup. Looking to collaborate with vocalists and other producers. Let's create something unique together.",
    imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=1200&fit=crop",
    audioPreviewUrl: "/demo.mp3",
  },
  {
    id: "3",
    name: "Jordan Brooks",
    age: 31,
    location: "Nashville, TN",
    instruments: ["Drums", "Percussion"],
    genres: ["Country", "Rock", "Blues"],
    bio: "Session drummer with 15 years behind the kit. Played on multiple albums and toured with several acts. Looking for my next musical adventure.",
    imageUrl: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&h=1200&fit=crop",
    audioPreviewUrl: "/demo.mp3",
  },
  {
    id: "4",
    name: "Sam Taylor",
    age: 26,
    location: "Austin, TX",
    instruments: ["Bass", "Double Bass"],
    genres: ["Jazz", "Funk", "Soul"],
    bio: "Groove-oriented bassist who lives for the pocket. Equally comfortable in a jazz trio or a funk band. Looking for players who appreciate the low end.",
    imageUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&h=1200&fit=crop",
    audioPreviewUrl: "/demo.mp3",
  },
  {
    id: "5",
    name: "Riley Morgan",
    age: 23,
    location: "Seattle, WA",
    instruments: ["Vocals", "Songwriting"],
    genres: ["Folk", "Indie", "Acoustic"],
    bio: "Singer-songwriter with a passion for storytelling. Looking for instrumentalists to bring my songs to life on stage. Coffee shop gigs to arena dreams.",
    imageUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&h=1200&fit=crop",
    audioPreviewUrl: "/demo.mp3",
  },
]

export default function FeedPage() {
  const handleLike = (musicianId: string) => {
    console.log("Liked:", musicianId)
    // Will be implemented with Supabase
  }

  const handlePass = (musicianId: string) => {
    console.log("Passed:", musicianId)
    // Will be implemented with Supabase
  }

  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
      {mockMusicians.map((musician) => (
        <MusicianCard
          key={musician.id}
          musician={musician}
          onLike={() => handleLike(musician.id)}
          onPass={() => handlePass(musician.id)}
        />
      ))}
    </div>
  )
}
