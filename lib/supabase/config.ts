function getRequiredPublicEnv(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }

  return value
}

export const supabase_config = {
  storageBuckets: {
    profilePhotos: getRequiredPublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_PROFILE_PHOTOS_BUCKET,
      "NEXT_PUBLIC_SUPABASE_PROFILE_PHOTOS_BUCKET",
    ),
  },
} as const
