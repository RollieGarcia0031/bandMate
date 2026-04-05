"use client"

import { useEffect, useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { resolveProfilePhotoUrl } from "@/lib/supabase/storage-cache-control"

export type ProfileData = {
  id: string
  username: string
  displayName: string
  avatar: string
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle()

      const { data: photoRows } = await supabase
        .from("profile_photos")
        .select("url, uploaded_at")
        .eq("user_id", user.id)
        .order("order", { ascending: true })
        .limit(1)

      let avatarUrl = ""
      if (photoRows?.[0]?.url) {
        avatarUrl = resolveProfilePhotoUrl(supabase, photoRows[0].url, photoRows[0].uploaded_at)
      }

      setProfile({
        id: user.id,
        username: profileData?.username || "",
        displayName: profileData?.display_name || user.email?.split("@")[0] || "User",
        avatar: avatarUrl,
      })
      setLoading(false)
    }

    fetchProfile()
  }, [])

  return { profile, loading }
}
