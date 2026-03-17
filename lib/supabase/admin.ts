import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdminEnv } from "@/lib/supabase/env"

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminEnv()

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
