"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { ArrowLeft, Camera, Check, MapPin, Music, Save, Undo2 } from "lucide-react"
import { saveSettingsAction } from "@/app/(authenticated)/settings/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { supabase_config } from "@/lib/supabase/config"
import {
  EXPERIENCE_LEVELS,
  GENDER_OPTIONS,
  GENRES,
  INSTRUMENTS,
  LOOKING_FOR,
  normalizeSettingsFormData,
  type SettingsFormData,
} from "@/lib/profile/settings"

type SettingsFormProps = {
  initialData: SettingsFormData
  userId: string
}

const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024

export function SettingsForm({ initialData, userId }: SettingsFormProps) {
  const [formData, setFormData] = useState(initialData)
  const [savedSnapshot, setSavedSnapshot] = useState(initialData)
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSaving, startTransition] = useTransition()
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const isDirty = useMemo(() => {
    return JSON.stringify(normalizeSettingsFormData(formData)) !== JSON.stringify(normalizeSettingsFormData(savedSnapshot))
  }, [formData, savedSnapshot])

  function handleInputChange(field: keyof SettingsFormData, value: string | number) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setFeedback(null)
  }

  function toggleArrayField(field: "instruments" | "genres" | "lookingFor", item: string) {
    setFormData((prev) => {
      const values = prev[field]
      return {
        ...prev,
        [field]: values.includes(item) ? values.filter((value) => value !== item) : [...values, item],
      }
    })
    setFeedback(null)
  }

  /**
   * Discard restores the last successfully loaded or saved snapshot instead of
   * navigating away, which makes the action safe and predictable for users who
   * just want to undo local edits.
   */
  function handleDiscard() {
    setFormData(savedSnapshot)
    setFeedback(null)

    if (photoInputRef.current) {
      photoInputRef.current.value = ""
    }
  }

  function handleSave() {
    setFeedback(null)
    startTransition(async () => {
      const result = await saveSettingsAction(formData)

      if (!result.success) {
        setFeedback({ tone: "error", message: result.message })
        return
      }

      setFormData(result.data)
      setSavedSnapshot(result.data)
      setFeedback({ tone: "success", message: "Your profile settings were saved." })
    })
  }

  /**
   * Uploads the selected image into the configured Supabase storage bucket,
   * updates the local preview immediately, and leaves final persistence to the
   * regular Save Changes action so picture updates follow the same discard flow.
   */
  async function handleProfilePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setFeedback({ tone: "error", message: "Please choose an image file for your profile picture." })
      event.target.value = ""
      return
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setFeedback({ tone: "error", message: "Profile pictures must be 5 MB or smaller." })
      event.target.value = ""
      return
    }

    setIsUploadingPhoto(true)
    setFeedback(null)

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const filePath = `${userId}/profile.${extension}`
      const supabase = createSupabaseBrowserClient()
      const uploadResult = await supabase.storage
        .from(supabase_config.storageBuckets.profilePhotos)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        })

      if (uploadResult.error) {
        setFeedback({ tone: "error", message: uploadResult.error.message })
        return
      }

      const { data } = supabase.storage
        .from(supabase_config.storageBuckets.profilePhotos)
        .getPublicUrl(filePath)

      handleInputChange("avatar", `${data.publicUrl}?v=${Date.now()}`)
      setFeedback({ tone: "success", message: "Profile picture uploaded. Save changes to apply it to your profile." })
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "We could not upload your profile picture.",
      })
    } finally {
      setIsUploadingPhoto(false)
      event.target.value = ""
    }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-8">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <Link href="/me">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Profile fields are loaded from your BandMate profile in Supabase.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        {feedback && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/50 bg-destructive/10 text-destructive"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Profile Picture</h2>
          <div className="flex items-center gap-4">
            <div
              className="h-24 w-24 rounded-full border-2 border-border bg-cover bg-center bg-muted"
              style={{ backgroundImage: formData.avatar ? `url(${formData.avatar})` : undefined }}
            />
            <div className="space-y-2">
              <input
                ref={photoInputRef}
                id="profile-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePhotoChange}
                disabled={isUploadingPhoto || isSaving}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto || isSaving}
              >
                <Camera className="h-4 w-4" />
                {isUploadingPhoto ? "Uploading..." : "Update Picture"}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, and GIF up to 5 MB.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-b border-border pb-6">
          <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Username"
                value={formData.username}
                onChange={(event) => handleInputChange("username", event.target.value)}
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Display Name"
                value={formData.displayName}
                onChange={(event) => handleInputChange("displayName", event.target.value)}
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
              onChange={(event) => handleInputChange("bio", event.target.value)}
              maxLength={500}
              rows={4}
              className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">{formData.bio.length}/500</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={formData.birthday}
                onChange={(event) => handleInputChange("birthday", event.target.value)}
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(event) => handleInputChange("gender", event.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-b border-border pb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Music className="h-5 w-5 text-primary" />
            Music Information
          </h2>

          <div className="space-y-2">
            <Label>Instruments</Label>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {INSTRUMENTS.map((instrument) => {
                const selected = formData.instruments.includes(instrument)

                return (
                  <button
                    key={instrument}
                    type="button"
                    onClick={() => toggleArrayField("instruments", instrument)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary"
                    }`}
                  >
                    {instrument}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Genres</Label>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {GENRES.map((genre) => {
                const selected = formData.genres.includes(genre)

                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleArrayField("genres", genre)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary"
                    }`}
                  >
                    {genre}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="experienceYears">Experience (Years)</Label>
              <Input
                id="experienceYears"
                type="number"
                min="0"
                max="100"
                value={formData.experienceYears}
                onChange={(event) => handleInputChange("experienceYears", Number(event.target.value) || 0)}
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experienceLevel">Experience Level</Label>
              <select
                id="experienceLevel"
                value={formData.experienceLevel}
                onChange={(event) => handleInputChange("experienceLevel", event.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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

        <section className="space-y-4 border-b border-border pb-6">
          <h2 className="text-lg font-semibold text-foreground">What Are You Looking For?</h2>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {LOOKING_FOR.map((item) => {
              const selected = formData.lookingFor.includes(item)

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleArrayField("lookingFor", item)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary"
                  }`}
                >
                  {item}
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-4 border-b border-border pb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <MapPin className="h-5 w-5 text-primary" />
            Location & Links
          </h2>

          <div className="space-y-2">
            <Label htmlFor="city">City/Location</Label>
            <Input
              id="city"
              placeholder="San Francisco, CA"
              value={formData.city}
              onChange={(event) => handleInputChange("city", event.target.value)}
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
              onChange={(event) => handleInputChange("youtubeUrl", event.target.value)}
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
              onChange={(event) => handleInputChange("spotifyUrl", event.target.value)}
              className="bg-card"
            />
          </div>
        </section>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={isSaving || isUploadingPhoto || !isDirty} className="h-12 flex-1 gap-2">
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Saving...
              </>
            ) : feedback?.tone === "success" && !isDirty ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
          <Button variant="outline" className="h-12 flex-1 gap-2" onClick={handleDiscard} disabled={!isDirty || isSaving || isUploadingPhoto}>
            <Undo2 className="h-4 w-4" />
            Discard
          </Button>
        </div>
      </div>
    </div>
  )
}
