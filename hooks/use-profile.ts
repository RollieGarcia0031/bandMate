"use client"

import { useEffect, useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { supabase_config } from "@/lib/supabase/config"

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
        const photoUrl = photoRows[0].url
        if (photoUrl.startsWith("http")) {
          avatarUrl = photoUrl
        } else {
          const { data } = supabase.storage
            .from(supabase_config.storageBuckets.profilePhotos)
            .getPublicUrl(photoUrl)
          avatarUrl = data.publicUrl
        }
        
        if (photoRows[0].uploaded_at) {
          const cacheBuster = `v=${encodeURIComponent(photoRows[0].uploaded_at)}`
          avatarUrl = `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}${cacheBuster}`
        }
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
