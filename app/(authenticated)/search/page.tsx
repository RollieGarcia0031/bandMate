"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Loader2, Music, MapPin, Search, Sliders, Users, UserRound, ChevronDown, ChevronUp } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase_config } from "@/lib/supabase/config"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const genres = ["Rock", "Pop", "Jazz", "Electronic", "Hip Hop", "R&B", "Country", "Classical", "Metal", "Folk", "Indie", "Blues"]
const instruments = ["Guitar", "Bass", "Drums", "Piano", "Vocals", "Violin", "Saxophone", "Trumpet", "DJ", "Production"]

const trendingSearches = [
  { label: "Drummers in LA", icon: Users },
  { label: "Jazz pianists", icon: Music },
  { label: "Bands forming near me", icon: MapPin },
]

type SearchResult = {
  id: string
  username: string
  displayName: string
  bio: string
  city: string
  instruments: string[]
  genres: string[]
  avatar: string
}


type CacheEntry = {
  results: SearchResult[]
  timestamp: number
}

const CACHE_TTL_MS = 90_000
const SESSION_CACHE_KEY = "search-page-cache-v1"
const SESSION_CACHE_LIMIT = 10

const normalizeQuery = (query: string) => query.trim().toLowerCase()

const normalizeFilterValues = (values: string[]) =>
  values.map((value) => value.toLowerCase()).sort()

const buildCacheKey = (query: string, genres: string[], instrumentValues: string[]) =>
  JSON.stringify({
    query: normalizeQuery(query),
    appliedGenres: normalizeFilterValues(genres),
    appliedInstruments: normalizeFilterValues(instrumentValues),
  })

const parseCsvParam = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : []

export default function SearchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())
  const initializedFromUrlRef = useRef(false)
  const latestSearchIdRef = useRef(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [pendingGenres, setPendingGenres] = useState<string[]>([])
  const [pendingInstruments, setPendingInstruments] = useState<string[]>([])
  const [appliedGenres, setAppliedGenres] = useState<string[]>([])
  const [appliedInstruments, setAppliedInstruments] = useState<string[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentSearchKey = useMemo(
    () => buildCacheKey(searchQuery, appliedGenres, appliedInstruments),
    [searchQuery, appliedGenres, appliedInstruments]
  )

  const persistCacheToSessionStorage = useCallback(() => {
    try {
      const entries = Array.from(cacheRef.current.entries()).slice(-SESSION_CACHE_LIMIT)
      sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(entries))
    } catch {
      // Ignore storage failures and continue with in-memory cache.
    }
  }, [])

  const updateCache = useCallback((cacheKey: string, nextResults: SearchResult[]) => {
    cacheRef.current.set(cacheKey, {
      results: nextResults,
      timestamp: Date.now(),
    })

    if (cacheRef.current.size > SESSION_CACHE_LIMIT) {
      const oldestKey = cacheRef.current.keys().next().value
      if (oldestKey) {
        cacheRef.current.delete(oldestKey)
      }
    }

    persistCacheToSessionStorage()
  }, [persistCacheToSessionStorage])

  const fetchSearchResults = useCallback(async (
    queryText: string,
    genreFilters: string[],
    instrumentFilters: string[]
  ) => {
    const supabase = createSupabaseBrowserClient()

    let query = supabase
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        bio,
        city,
        user_instruments (
          instruments (name)
        ),
        user_genres (
          genres (name)
        ),
        profile_photos (
          url,
          uploaded_at
        )
      `)

    if (queryText.trim()) {
      const textQuery = `%${queryText.trim()}%`
      query = query.or(`username.ilike.${textQuery},display_name.ilike.${textQuery}`)
    }

    const { data, error: searchError } = await query.limit(50)

    if (searchError) {
      throw searchError
    }

    let mappedResults: SearchResult[] = (data ?? []).map((row: any) => {
      const instruments = (row.user_instruments ?? [])
        .map((ui: any) => ui.instruments?.name)
        .filter(Boolean)

      const genres = (row.user_genres ?? [])
        .map((ug: any) => ug.genres?.name)
        .filter(Boolean)

      const photo = row.profile_photos?.[0]
      let avatar = ""
      if (photo?.url) {
        const publicUrl = supabase.storage
          .from(supabase_config.storageBuckets.profilePhotos)
          .getPublicUrl(photo.url).data.publicUrl

        avatar = photo.uploaded_at ? `${publicUrl}?v=${encodeURIComponent(photo.uploaded_at)}` : publicUrl
      }

      return {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        bio: row.bio || "",
        city: row.city || "",
        instruments,
        genres,
        avatar,
      }
    })

    if (genreFilters.length > 0) {
      mappedResults = mappedResults.filter((profile) =>
        genreFilters.some((genre) => profile.genres.includes(genre))
      )
    }

    if (instrumentFilters.length > 0) {
      mappedResults = mappedResults.filter((profile) =>
        instrumentFilters.some((inst) => profile.instruments.includes(inst))
      )
    }

    return mappedResults
  }, [])

  const toggleGenre = (genre: string) => {
    setPendingGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }

  const toggleInstrument = (instrument: string) => {
    setPendingInstruments((prev) =>
      prev.includes(instrument) ? prev.filter((i) => i !== instrument) : [...prev, instrument]
    )
  }

  const applyFilters = () => {
    setAppliedGenres(pendingGenres)
    setAppliedInstruments(pendingInstruments)
    // We close the filter panel if you clicked apply, as it's a clear action point.
    setIsFiltersOpen(false)
  }

  const clearPendingFilters = () => {
    setPendingGenres([])
    setPendingInstruments([])
  }

  const performSearch = useCallback(async (
    cacheKey: string,
    queryText: string,
    genreFilters: string[],
    instrumentFilters: string[],
    options?: { background?: boolean }
  ) => {
    const searchId = ++latestSearchIdRef.current
    const background = options?.background ?? false

    if (!background) {
      setIsSearching(true)
    }
    setError(null)

    try {
      const mappedResults = await fetchSearchResults(queryText, genreFilters, instrumentFilters)

      if (searchId !== latestSearchIdRef.current) {
        return
      }

      setResults(mappedResults)
      updateCache(cacheKey, mappedResults)
    } catch (err) {
      if (searchId !== latestSearchIdRef.current) {
        return
      }

      setError(err instanceof Error ? err.message : "Search failed. Please try again.")
    } finally {
      if (!background && searchId === latestSearchIdRef.current) {
        setIsSearching(false)
      }
    }
  }, [fetchSearchResults, updateCache])

  useEffect(() => {
    if (initializedFromUrlRef.current) {
      return
    }

    const queryFromUrl = searchParams.get("q") ?? ""
    const genresFromUrl = parseCsvParam(searchParams.get("genres"))
    const instrumentsFromUrl = parseCsvParam(searchParams.get("instruments"))

    setSearchQuery(queryFromUrl)
    setAppliedGenres(genresFromUrl)
    setAppliedInstruments(instrumentsFromUrl)
    setPendingGenres(genresFromUrl)
    setPendingInstruments(instrumentsFromUrl)

    try {
      const rawCache = sessionStorage.getItem(SESSION_CACHE_KEY)
      if (rawCache) {
        const parsed = JSON.parse(rawCache) as [string, CacheEntry][]
        cacheRef.current = new Map(parsed)
      }
    } catch {
      cacheRef.current = new Map()
    }

    initializedFromUrlRef.current = true
  }, [searchParams])

  useEffect(() => {
    if (!initializedFromUrlRef.current) {
      return
    }

    const nextParams = new URLSearchParams()

    if (searchQuery.trim()) {
      nextParams.set("q", searchQuery.trim())
    }
    if (appliedGenres.length > 0) {
      nextParams.set("genres", appliedGenres.join(","))
    }
    if (appliedInstruments.length > 0) {
      nextParams.set("instruments", appliedInstruments.join(","))
    }

    const queryString = nextParams.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [appliedGenres, appliedInstruments, pathname, router, searchQuery])

  // Automatically trigger a search when the query or *applied* filters change.
  // This ensures text remains reactive while tags only apply on click.
  useEffect(() => {
    if (!initializedFromUrlRef.current) {
      return
    }

    const cached = cacheRef.current.get(currentSearchKey)
    const isFresh = cached ? Date.now() - cached.timestamp < CACHE_TTL_MS : false

    if (cached) {
      setResults(cached.results)
      setError(null)
      setIsSearching(false)

      if (!isFresh) {
        void performSearch(currentSearchKey, searchQuery, appliedGenres, appliedInstruments, { background: true })
      }

      return
    }

    const timeout = setTimeout(() => {
      void performSearch(currentSearchKey, searchQuery, appliedGenres, appliedInstruments)
    }, 400)

    return () => clearTimeout(timeout)
  }, [appliedGenres, appliedInstruments, currentSearchKey, performSearch, searchQuery])

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Search</h1>
          <p className="text-muted-foreground">Find musicians that match your vibe</p>
        </div>

        {/* Search Input and Collapsible Toggle */}
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, instrument, or location..."
              className="pl-12 pr-16 h-14 text-lg bg-card border-border"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 px-3 h-10 transition-colors",
                    isFiltersOpen ? "bg-secondary text-primary" : "text-muted-foreground"
                  )}
                >
                  <Sliders className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider">Filters</span>
                  {isFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent className="space-y-8 p-6 rounded-2xl bg-card border border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
            {/* Genre Filter */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">Genres</h2>
                {pendingGenres.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setPendingGenres([])} className="h-7 text-xs text-primary">
                    Clear ({pendingGenres.length})
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium transition-all border",
                      pendingGenres.includes(genre)
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-background border-border text-foreground hover:bg-secondary hover:border-border"
                    )}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument Filter */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">Instruments</h2>
                {pendingInstruments.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setPendingInstruments([])} className="h-7 text-xs text-primary">
                    Clear ({pendingInstruments.length})
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {instruments.map((instrument) => (
                  <button
                    key={instrument}
                    onClick={() => toggleInstrument(instrument)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium transition-all border",
                      pendingInstruments.includes(instrument)
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-background border-border text-foreground hover:bg-secondary hover:border-border"
                    )}
                  >
                    {instrument}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply and Reset Actions */}
            <div className="pt-6 border-t border-border flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={applyFilters}
                className="flex-1 h-12 bg-primary text-primary-foreground font-bold text-base shadow-sm hover:opacity-90"
              >
                Apply Filters ({pendingGenres.length + pendingInstruments.length})
              </Button>
              <Button 
                variant="outline"
                onClick={clearPendingFilters}
                className="sm:w-32 h-12 border-border hover:bg-secondary"
              >
                Reset
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Trending Searches (Only show when filters are closed and no results yet) */}
        {!isFiltersOpen && results.length === 0 && !isSearching && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Trending Searches</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {trendingSearches.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setSearchQuery(item.label.split(' in ')[0])}
                  className="flex items-center gap-4 w-full p-4 rounded-xl bg-card border border-border hover:bg-secondary hover:border-primary/30 transition-all text-left group"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary group-hover:bg-primary/10 transition-colors">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Section */}
        <div className="space-y-6 pb-20">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">
              {isSearching ? "Searching..." : results.length > 0 ? "Results" : searchQuery ? "No results found" : "Discover Musicians"}
            </h2>
            {results.length > 0 && (
              <span className="text-sm text-muted-foreground">{results.length} musicians found</span>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {isSearching && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Finding the best matches...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid gap-4">
              {results.map((profile) => (
                <Link 
                  key={profile.id}
                  href={`/user/${profile.id}`}
                  className="group flex flex-col sm:flex-row items-start gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all cursor-pointer"
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full overflow-hidden bg-secondary border-2 border-border group-hover:border-primary transition-colors">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <UserRound className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold text-foreground leading-none">{profile.displayName}</h3>
                        <p className="text-sm text-muted-foreground mt-1">@{profile.username}</p>
                      </div>
                      {profile.city && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          <MapPin className="w-3 h-3" />
                          {profile.city}
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-foreground line-clamp-2 italic">
                      {profile.bio || "No bio provided yet."}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {profile.instruments.map(inst => (
                        <span key={inst} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                          {inst}
                        </span>
                      ))}
                      {profile.genres.map(genre => (
                        <span key={genre} className="px-2 py-0.5 rounded-md bg-secondary text-foreground text-xs font-semibold">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : !isSearching && searchQuery && (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-foreground font-semibold">No musicians match "{searchQuery}"</p>
                <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
