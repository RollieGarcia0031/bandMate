export const GENRES = [
  "Rock",
  "Metal",
  "Jazz",
  "Blues",
  "Classical",
  "Hip-Hop",
  "R&B",
  "Electronic",
  "Pop",
  "Folk",
  "Country",
  "Reggae",
  "Punk",
  "Indie",
  "Soul",
  "Funk",
] as const

export const INSTRUMENTS = [
  "Guitar",
  "Bass",
  "Drums",
  "Piano / Keys",
  "Vocals",
  "Violin",
  "Cello",
  "Trumpet",
  "Saxophone",
  "Flute",
  "DJ / Turntables",
  "Producer",
  "Ukulele",
  "Mandolin",
  "Banjo",
  "Other",
] as const

export const LOOKING_FOR = [
  "Form a band",
  "Collaborate",
  "Jam sessions",
  "Find a teacher",
  "Teach",
  "Tour & perform",
] as const

export const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Expert"] as const

export type SettingsFormData = {
  username: string
  displayName: string
  bio: string
  birthday: string
  instruments: string[]
  genres: string[]
  gender: string
  youtubeUrl: string
  spotifyUrl: string
  city: string
  lookingFor: string[]
  experienceYears: number
  experienceLevel: string
  avatar: string
}

export const EMPTY_SETTINGS_FORM: SettingsFormData = {
  username: "",
  displayName: "",
  bio: "",
  birthday: "",
  instruments: [],
  genres: [],
  gender: "Prefer not to say",
  youtubeUrl: "",
  spotifyUrl: "",
  city: "",
  lookingFor: [],
  experienceYears: 0,
  experienceLevel: "Intermediate",
  avatar: "",
}

/**
 * Converts a profile-shaped object from Supabase into the exact client-side form
 * structure used by the settings screen, so the page can hydrate directly from
 * database values on first render.
 */
export function toSettingsFormData(profile: Partial<SettingsFormData> | null | undefined): SettingsFormData {
  return {
    username: profile?.username?.trim() ?? "",
    displayName: profile?.displayName?.trim() ?? "",
    bio: profile?.bio ?? "",
    birthday: profile?.birthday ?? "",
    instruments: uniqueStrings(profile?.instruments),
    genres: uniqueStrings(profile?.genres),
    gender: profile?.gender ?? "Prefer not to say",
    youtubeUrl: profile?.youtubeUrl ?? "",
    spotifyUrl: profile?.spotifyUrl ?? "",
    city: profile?.city ?? "",
    lookingFor: uniqueStrings(profile?.lookingFor),
    experienceYears: sanitizeYears(profile?.experienceYears),
    experienceLevel: profile?.experienceLevel ?? "Intermediate",
    avatar: profile?.avatar ?? "",
  }
}

/**
 * Produces a stable snapshot for dirty-state comparisons and discard/reset
 * behavior. Sorting multi-select arrays prevents false positives when values are
 * equivalent but stored in a different order.
 */
export function normalizeSettingsFormData(data: SettingsFormData): SettingsFormData {
  return {
    ...data,
    username: data.username.trim(),
    displayName: data.displayName.trim(),
    bio: data.bio.trim(),
    birthday: data.birthday,
    instruments: [...data.instruments].sort(),
    genres: [...data.genres].sort(),
    gender: data.gender,
    youtubeUrl: data.youtubeUrl.trim(),
    spotifyUrl: data.spotifyUrl.trim(),
    city: data.city.trim(),
    lookingFor: [...data.lookingFor].sort(),
    experienceYears: sanitizeYears(data.experienceYears),
    experienceLevel: data.experienceLevel,
    avatar: data.avatar.trim(),
  }
}

function uniqueStrings(values: string[] | readonly string[] | null | undefined) {
  return [...new Set((values ?? []).filter(Boolean))]
}

function sanitizeYears(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0
  }

  return Math.min(100, Math.trunc(value))
}
