import { SettingsForm } from "@/components/app/settings-form"
import { toSettingsFormData } from "@/lib/profile/settings"
import { supabase_config } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const initialData = toSettingsFormData(await getSettingsPageData(user.id))

  return <SettingsForm initialData={initialData} userId={user.id} />
}

/**
 * Fetches the full settings payload from the database in one place so the route
 * always opens with live profile data instead of local mock state.
 */
async function getSettingsPageData(userId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, birthday, gender, youtube_url, spotify_url, city, looking_for, experience_years, experience_level")
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
      .select("url, order")
      .eq("user_id", userId)
      .order("order", { ascending: true })
      .limit(1),
  ])

  return {
    username: profile?.username,
    displayName: profile?.display_name,
    bio: profile?.bio,
    birthday: profile?.birthday,
    gender: profile?.gender,
    youtubeUrl: profile?.youtube_url,
    spotifyUrl: profile?.spotify_url,
    city: profile?.city,
    lookingFor: profile?.looking_for,
    experienceYears: profile?.experience_years,
    experienceLevel: profile?.experience_level,
    instruments: (instrumentRows ?? [])
      .flatMap((row) => normalizeJoinedName(row.instruments))
      .filter(Boolean),
    genres: (genreRows ?? [])
      .flatMap((row) => normalizeJoinedName(row.genres))
      .filter(Boolean),
    avatar: resolveProfilePhotoUrl(supabase, photoRows?.[0]?.url),
  }
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
) {
  if (!photoUrl) {
    return ""
  }

  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
    return photoUrl
  }

  return supabase.storage
    .from(supabase_config.storageBuckets.profilePhotos)
    .getPublicUrl(photoUrl).data.publicUrl
}
