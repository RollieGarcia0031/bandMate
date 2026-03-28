import { cacheKeys, cacheTags, runCachedQuery } from "@/lib/cache"
import { supabase_config } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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

/**
 * Loads the authenticated user's profile and the related joins used by both the
 * settings and profile surfaces so they render from the same Supabase source of
 * truth.
 */
export async function getCurrentUserProfile(userId: string): Promise<CurrentUserProfile> {
  return runCachedQuery(
    cacheKeys.profile(userId),
    [cacheTags.profile(userId)],
    async () => {
      const supabase = await createSupabaseServerClient()

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, bio, birthday, gender, youtube_url, spotify_url, city, looking_for, experience_years, experience_level, created_at")
        .eq("id", userId)
        .maybeSingle()

      const [{ data: instrumentRows }, { data: genreRows }, { data: photoRows }, authUser] = await Promise.all([
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
        supabase.auth.getUser().then((result) => result.data.user ?? null),
      ])

      const birthday = profile?.birthday ?? ""

      return {
        id: userId,
        email: authUser?.email ?? "",
        username: profile?.username ?? "",
        displayName: profile?.display_name ?? authUser?.user_metadata?.full_name ?? authUser?.email?.split("@")[0] ?? "BandMate member",
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
        avatar: resolveProfilePhotoUrl(supabase, photoRows?.[0]?.url, photoRows?.[0]?.uploaded_at),
        joinedDate: authUser?.created_at ?? profile?.created_at ?? null,
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

function resolveProfilePhotoUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  photoUrl: string | undefined,
  uploadedAt: string | null | undefined,
) {
  if (!photoUrl) {
    return ""
  }

  const cacheBuster = uploadedAt ? `v=${encodeURIComponent(uploadedAt)}` : ""

  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
    if (!cacheBuster) {
      return photoUrl
    }

    return `${photoUrl}${photoUrl.includes("?") ? "&" : "?"}${cacheBuster}`
  }

  const publicUrl = supabase.storage
    .from(supabase_config.storageBuckets.profilePhotos)
    .getPublicUrl(photoUrl).data.publicUrl

  return cacheBuster ? `${publicUrl}?${cacheBuster}` : publicUrl
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
