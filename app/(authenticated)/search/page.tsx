"use client"

import { useState } from "react"
import { Search, Sliders, Music, MapPin, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const genres = ["Rock", "Pop", "Jazz", "Electronic", "Hip Hop", "R&B", "Country", "Classical", "Metal", "Folk", "Indie", "Blues"]
const instruments = ["Guitar", "Bass", "Drums", "Piano", "Vocals", "Violin", "Saxophone", "Trumpet", "DJ", "Production"]

const trendingSearches = [
  { label: "Drummers in LA", icon: Users },
  { label: "Jazz pianists", icon: Music },
  { label: "Bands forming near me", icon: MapPin },
]

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([])

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }

  const toggleInstrument = (instrument: string) => {
    setSelectedInstruments((prev) =>
      prev.includes(instrument) ? prev.filter((i) => i !== instrument) : [...prev, instrument]
    )
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Search</h1>
          <p className="text-muted-foreground">Find musicians that match your vibe</p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, instrument, or location..."
            className="pl-12 pr-12 h-14 text-lg bg-card border-border"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <Sliders className="w-5 h-5" />
          </Button>
        </div>

        {/* Trending Searches */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Trending</h2>
          <div className="space-y-2">
            {trendingSearches.map((item) => (
              <button
                key={item.label}
                className="flex items-center gap-4 w-full p-4 rounded-xl bg-card hover:bg-secondary transition-colors text-left"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Genre Filter */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Genres</h2>
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  selectedGenres.includes(genre)
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-secondary"
                )}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Instrument Filter */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Instruments</h2>
          <div className="flex flex-wrap gap-2">
            {instruments.map((instrument) => (
              <button
                key={instrument}
                onClick={() => toggleInstrument(instrument)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  selectedInstruments.includes(instrument)
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-secondary"
                )}
              >
                {instrument}
              </button>
            ))}
          </div>
        </div>

        {/* Apply Button */}
        {(selectedGenres.length > 0 || selectedInstruments.length > 0) && (
          <Button className="w-full h-14 text-lg">
            Apply Filters ({selectedGenres.length + selectedInstruments.length})
          </Button>
        )}
      </div>
    </div>
  )
}
