"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { normalizeSettingsFormData, type SettingsFormData } from "@/lib/profile/settings"

type SaveSettingsResult =
  | { success: true; data: SettingsFormData }
  | { success: false; message: string }

export async function saveSettingsAction(payload: SettingsFormData): Promise<SaveSettingsResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, message: "You must be signed in to update your settings." }
  }

  const data = normalizeSettingsFormData(payload)

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    username: data.username,
    display_name: data.displayName,
    bio: data.bio || null,
    birthday: data.birthday || null,
    gender: data.gender || null,
    city: data.city || null,
    youtube_url: data.youtubeUrl || null,
    spotify_url: data.spotifyUrl || null,
    looking_for: data.lookingFor.length > 0 ? data.lookingFor : null,
    experience_years: data.experienceYears,
    experience_level: data.experienceLevel,
  })

  if (profileError) {
    return { success: false, message: profileError.message }
  }

  const syncInstruments = await syncNamedRelations({
    supabase,
    table: "instruments",
    joinTable: "user_instruments",
    joinColumn: "instrument_id",
    userId: user.id,
    names: data.instruments,
  })

  if (!syncInstruments.success) {
    return syncInstruments
  }

  const syncGenres = await syncNamedRelations({
    supabase,
    table: "genres",
    joinTable: "user_genres",
    joinColumn: "genre_id",
    userId: user.id,
    names: data.genres,
  })

  if (!syncGenres.success) {
    return syncGenres
  }

  revalidatePath("/settings")
  revalidatePath("/me")

  return { success: true, data }
}

/**
 * Keeps the many-to-many lookup tables aligned with the settings form. We first
 * upsert selectable names into the lookup table and then replace the user's join
 * rows so the database exactly mirrors the latest saved selection.
 */
async function syncNamedRelations({
  supabase,
  table,
  joinTable,
  joinColumn,
  userId,
  names,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  table: "instruments" | "genres"
  joinTable: "user_instruments" | "user_genres"
  joinColumn: "instrument_id" | "genre_id"
  userId: string
  names: string[]
}): Promise<SaveSettingsResult | { success: true }> {
  const uniqueNames = [...new Set(names.filter(Boolean))]

  const { error: deleteError } = await supabase.from(joinTable).delete().eq("user_id", userId)

  if (deleteError) {
    return { success: false, message: deleteError.message }
  }

  if (uniqueNames.length === 0) {
    return { success: true }
  }

  const { error: upsertLookupError } = await supabase.from(table).upsert(
    uniqueNames.map((name) => ({ name })),
    { onConflict: "name", ignoreDuplicates: false },
  )

  if (upsertLookupError) {
    return { success: false, message: upsertLookupError.message }
  }

  const { data: lookupRows, error: lookupError } = await supabase
    .from(table)
    .select("id, name")
    .in("name", uniqueNames)

  if (lookupError) {
    return { success: false, message: lookupError.message }
  }

  const relationRows = (lookupRows ?? []).map((row) => ({
    user_id: userId,
    [joinColumn]: row.id,
  }))

  const { error: insertError } = await supabase.from(joinTable).insert(relationRows)

  if (insertError) {
    return { success: false, message: insertError.message }
  }

  return { success: true }
}
