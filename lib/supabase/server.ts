import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabaseServerEnv } from "@/lib/supabase/env"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseServerEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Array<{
        name: string
        value: string
        options?: Parameters<typeof cookieStore.set>[2]
      }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}
