"use client"

import { useState } from "react"
import { ArrowLeft, Camera, Save, Music, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

const GENRES = [
  "Rock", "Metal", "Jazz", "Blues", "Classical", "Hip-Hop",
  "R&B", "Electronic", "Pop", "Folk", "Country", "Reggae",
  "Punk", "Indie", "Soul", "Funk",
]

const INSTRUMENTS = [
  "Guitar", "Bass", "Drums", "Piano / Keys", "Vocals", "Violin",
  "Cello", "Trumpet", "Saxophone", "Flute", "DJ / Turntables", "Producer",
  "Ukulele", "Mandolin", "Banjo", "Other",
]

const LOOKING_FOR = [
  "Form a band",
  "Collaborate",
  "Jam sessions",
  "Find a teacher",
  "Teach",
  "Tour & perform",
]

const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Expert"]

// Mock user data - will be replaced with Supabase auth
const mockUserData = {
  username: "jamiewilson",
  displayName: "Jamie Wilson",
  bio: "Multi-instrumentalist and producer. Always looking for new sounds and collaborations.",
  birthday: "1997-05-15",
  instruments: ["Guitar", "Piano"],
  genres: ["Indie", "Electronic"],
  gender: "Other",
  youtubeUrl: "https://youtube.com/jamiewilson",
  spotifyUrl: "https://open.spotify.com/artist/jamiewilson",
  city: "San Francisco, CA",
  lookingFor: ["Collaborate", "Jam sessions"],
  experienceYears: 10,
  type: "Expert",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop",
}

export default function SettingsPage() {
  const [formData, setFormData] = useState(mockUserData)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const toggleArrayField = (field: "instruments" | "genres" | "lookingFor", item: string) => {
    setFormData((prev) => {
      const arr = prev[field] as string[]
      return {
        ...prev,
        [field]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      }
    })
    setSaved(false)
  }

  const handleSave = async () => {
    setLoading(true)
    // Simulate save delay
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-40 border-b border-border">
        <div className="flex items-center gap-4 px-4 py-4 max-w-4xl mx-auto">
          <Link href="/me">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Profile Picture */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Profile Picture</h2>
          <div className="flex items-center gap-4">
            <div
              className="w-24 h-24 rounded-full bg-cover bg-center border-2 border-border"
              style={{ backgroundImage: `url(${formData.avatar})` }}
            />
            <Button variant="outline" className="gap-2">
              <Camera className="w-4 h-4" />
              Change Picture
            </Button>
          </div>
        </section>

        {/* Personal Info */}
        <section className="space-y-4 pb-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Username"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Display Name"
                value={formData.displayName}
                onChange={(e) => handleInputChange("displayName", e.target.value)}
                className="bg-card"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              placeholder="Tell us about yourself"
              value={formData.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
              maxLength={500}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <p className="text-xs text-muted-foreground">{formData.bio.length}/500</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={formData.birthday}
                onChange={(e) => handleInputChange("birthday", e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => handleInputChange("gender", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </section>

        {/* Music Info */}
        <section className="space-y-4 pb-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Music Information
          </h2>

          <div className="space-y-2">
            <Label>Instruments</Label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {INSTRUMENTS.map((instrument) => (
                <button
                  key={instrument}
                  onClick={() => toggleArrayField("instruments", instrument)}
                  className={`px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                    formData.instruments.includes(instrument)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-foreground hover:border-primary"
                  }`}
                >
                  {instrument}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Genres</Label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleArrayField("genres", genre)}
                  className={`px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                    formData.genres.includes(genre)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-foreground hover:border-primary"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="experience">Experience (Years)</Label>
              <Input
                id="experience"
                type="number"
                min="0"
                max="100"
                value={formData.experienceYears}
                onChange={(e) => handleInputChange("experienceYears", parseInt(e.target.value))}
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Experience Level</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => handleInputChange("type", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Looking For */}
        <section className="space-y-4 pb-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">What Are You Looking For?</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {LOOKING_FOR.map((item) => (
              <button
                key={item}
                onClick={() => toggleArrayField("lookingFor", item)}
                className={`px-4 py-3 rounded-lg border transition-all text-sm font-medium text-left ${
                  formData.lookingFor.includes(item)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-foreground hover:border-primary"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {/* Location & URLs */}
        <section className="space-y-4 pb-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Location & Links
          </h2>

          <div className="space-y-2">
            <Label htmlFor="city">City/Location</Label>
            <Input
              id="city"
              placeholder="San Francisco, CA"
              value={formData.city}
              onChange={(e) => handleInputChange("city", e.target.value)}
              className="bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="youtube">YouTube URL</Label>
            <Input
              id="youtube"
              type="url"
              placeholder="https://youtube.com/yourhandle"
              value={formData.youtubeUrl}
              onChange={(e) => handleInputChange("youtubeUrl", e.target.value)}
              className="bg-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spotify">Spotify URL</Label>
            <Input
              id="spotify"
              type="url"
              placeholder="https://open.spotify.com/artist/yourhandle"
              value={formData.spotifyUrl}
              onChange={(e) => handleInputChange("spotifyUrl", e.target.value)}
              className="bg-card"
            />
          </div>
        </section>

        {/* Save Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 h-12 gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
          <Link href="/me" className="flex-1">
            <Button variant="outline" className="w-full h-12">
              Cancel
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
