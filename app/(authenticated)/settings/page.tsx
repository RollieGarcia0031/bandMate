import { SettingsForm } from "@/components/app/settings-form"
import { toSettingsFormData } from "@/lib/profile/settings"
import { getCurrentUserProfile } from "@/lib/profile/current-user-profile"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const initialData = toSettingsFormData(await getCurrentUserProfile(user.id))

  return <SettingsForm initialData={initialData} userId={user.id} />
}
