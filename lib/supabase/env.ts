const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getRequiredEnv(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }

  return value
}

export function getSupabaseBrowserEnv() {
  return {
    url: getRequiredEnv(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getRequiredEnv(SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  }
}

export function getSupabaseServerEnv() {
  return {
    url: getRequiredEnv(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getRequiredEnv(SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  }
}

export function getSupabaseAdminEnv() {
  return {
    url: getRequiredEnv(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: getRequiredEnv(SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
  }
}
