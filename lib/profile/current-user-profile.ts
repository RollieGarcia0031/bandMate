import { cacheKeys, cacheTags, runCachedQuery } from "@/lib/cache"
import { resolveProfilePhotoUrl } from "@/lib/supabase/storage-cache-control"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export type CurrentUserProfile = {
  id: string
  email: string
  username: string
  displayName: string
  bio: string
  birthday: string
  age: number | null
  city: string
  gender: string
  youtubeUrl: string
  spotifyUrl: string
  lookingFor: string[]
  experienceYears: number
  experienceLevel: string
  instruments: string[]
  genres: string[]
  avatar: string
  joinedDate: string | null
}

type AuthUserContext = {
  id: string
  email?: string | null
  created_at?: string | null
  user_metadata?: {
    full_name?: string | null
  } | null
}

type CachedProfilePayload = {
  username: string
  displayName: string
  bio: string
  birthday: string
  age: number | null
  city: string
  gender: string
  youtubeUrl: string
  spotifyUrl: string
  lookingFor: string[]
  experienceYears: number
  experienceLevel: string
  instruments: string[]
  genres: string[]
  avatar: string
  profileCreatedAt: string | null
}

/**
 * Loads the authenticated user's profile and the related joins used by both the
 * settings and profile surfaces so they render from the same Supabase source of
 * truth.
 */
export async function getCurrentUserProfile(authUser: AuthUserContext): Promise<CurrentUserProfile> {
  const cachedProfile = await getCachedProfileData(authUser.id)

  return {
    id: authUser.id,
    email: authUser.email ?? "",
    username: cachedProfile.username,
    displayName: cachedProfile.displayName || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "BandMate member",
    bio: cachedProfile.bio,
    birthday: cachedProfile.birthday,
    age: cachedProfile.age,
    city: cachedProfile.city,
    gender: cachedProfile.gender,
    youtubeUrl: cachedProfile.youtubeUrl,
    spotifyUrl: cachedProfile.spotifyUrl,
    lookingFor: cachedProfile.lookingFor,
    experienceYears: cachedProfile.experienceYears,
    experienceLevel: cachedProfile.experienceLevel,
    instruments: cachedProfile.instruments,
    genres: cachedProfile.genres,
    avatar: cachedProfile.avatar,
    joinedDate: authUser.created_at ?? cachedProfile.profileCreatedAt,
  }
}

async function getCachedProfileData(userId: string): Promise<CachedProfilePayload> {
  /**
   * Cache per user to avoid repeating the same profile joins on each request.
   * Invalidation is handled by `revalidateProfileTag(userId)` in write actions.
   */
  return runCachedQuery(
    cacheKeys.profile(userId),
    [cacheTags.profile(userId)],
    async () => {
      const supabase = createSupabaseAdminClient()

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, bio, birthday, gender, youtube_url, spotify_url, city, looking_for, experience_years, experience_level, created_at")
        .eq("id", userId)
        .maybeSingle()

      const [{ data: instrumentRows }, { data: genreRows }, { data: photoRows }] = await Promise.all([
        supabase
          .from("user_instruments")
          .select("instruments(name)")
          .eq("user_id", userId),
        supabase
          .from("user_genres")
          .select("genres(name)")
          .eq("user_id", userId),
        supabase
          .from("profile_photos")
          .select("url, order, uploaded_at")
          .eq("user_id", userId)
          .order("order", { ascending: true })
          .limit(1),
      ])

      const birthday = profile?.birthday ?? ""

      return {
        username: profile?.username ?? "",
        displayName: profile?.display_name ?? "",
        bio: profile?.bio ?? "",
        birthday,
        age: calculateAge(birthday),
        city: profile?.city ?? "",
        gender: profile?.gender ?? "Prefer not to say",
        youtubeUrl: profile?.youtube_url ?? "",
        spotifyUrl: profile?.spotify_url ?? "",
        lookingFor: profile?.looking_for ?? [],
        experienceYears: profile?.experience_years ?? 0,
        experienceLevel: profile?.experience_level ?? "Intermediate",
        instruments: (instrumentRows ?? []).flatMap((row) => normalizeJoinedName(row.instruments)).filter(Boolean),
        genres: (genreRows ?? []).flatMap((row) => normalizeJoinedName(row.genres)).filter(Boolean),
        avatar: photoRows?.[0]?.url ? resolveProfilePhotoUrl(supabase, photoRows[0].url, photoRows[0].uploaded_at) : "",
        profileCreatedAt: profile?.created_at ?? null,
      }
    },
  )
}

function normalizeJoinedName(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeJoinedName(entry))
  }

  if (value && typeof value === "object" && "name" in value && typeof value.name === "string") {
    return [value.name]
  }

  return []
}

function calculateAge(birthday: string) {
  if (!birthday) {
    return null
  }

  const birthDate = new Date(birthday)

  if (Number.isNaN(birthDate.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear()
  const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1
  }

  return age >= 0 ? age : null
}
