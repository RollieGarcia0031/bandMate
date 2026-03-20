function getRequiredPublicEnv(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }

  return value
}

/**
 * Centralize public bucket names so every authenticated client feature points
 * at the same storage location without duplicating environment variable lookups.
 */
export const supabase_config = {
  storageBuckets: {
    profilePhotos: getRequiredPublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_PROFILE_PHOTOS_BUCKET,
      "NEXT_PUBLIC_SUPABASE_PROFILE_PHOTOS_BUCKET",
    ),
    userPosts: getRequiredPublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_USER_POSTS_BUCKET,
      "NEXT_PUBLIC_SUPABASE_USER_POSTS_BUCKET",
    ),
  },
} as const
