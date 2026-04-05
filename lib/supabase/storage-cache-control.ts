import { supabase_config } from "@/lib/supabase/config"

const VERSIONED_CACHE_CONTROL = "public, max-age=31536000, immutable"
const DEFAULT_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=60"
const SUPABASE_PUBLIC_OBJECT_PATH_PREFIX = "/storage/v1/object/public/"
const CONTENT_HASH_PATH_PATTERN = /(?:^|[-_.])[a-f0-9]{8,}(?=\.[a-z0-9]+$|$)/i

export function getSupabaseObjectCacheControlPolicy(url: URL) {
  const hasVersionQuery = url.searchParams.has("v")
  const hasContentHash = CONTENT_HASH_PATH_PATTERN.test(url.pathname)

  return hasVersionQuery || hasContentHash ? VERSIONED_CACHE_CONTROL : DEFAULT_CACHE_CONTROL
}

export function resolveProfilePhotoUrl(
  supabase: {
    storage: {
      from: (bucket: string) => {
        getPublicUrl: (path: string) => { data: { publicUrl: string } }
      }
    }
  },
  photoUrl: string,
  uploadedAt?: string | null,
) {
  const version = uploadedAt ? encodeURIComponent(uploadedAt) : ""

  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
    const externalWithVersion = appendVersionParam(photoUrl, version)
    const parsedSupabaseUrl = toSupabasePublicObjectPath(externalWithVersion)

    if (!parsedSupabaseUrl) {
      return externalWithVersion
    }

    return toStorageProxyUrl(parsedSupabaseUrl.bucket, parsedSupabaseUrl.objectPath, parsedSupabaseUrl.version)
  }

  return toStorageProxyUrl(supabase_config.storageBuckets.profilePhotos, photoUrl, version)
}

function appendVersionParam(url: string, encodedVersion: string) {
  if (!encodedVersion) {
    return url
  }

  return `${url}${url.includes("?") ? "&" : "?"}v=${encodedVersion}`
}

function toSupabasePublicObjectPath(url: string) {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }

  const objectPath = parsedUrl.pathname
  const publicPathIndex = objectPath.indexOf(SUPABASE_PUBLIC_OBJECT_PATH_PREFIX)

  if (publicPathIndex === -1) {
    return null
  }

  const suffix = objectPath.slice(publicPathIndex + SUPABASE_PUBLIC_OBJECT_PATH_PREFIX.length)
  const [bucket, ...pathParts] = suffix.split("/")

  if (!bucket || pathParts.length === 0) {
    return null
  }

  const version = parsedUrl.searchParams.get("v") ?? ""

  return {
    bucket: decodeURIComponent(bucket),
    objectPath: pathParts.map((part) => decodeURIComponent(part)).join("/"),
    version: version ? encodeURIComponent(version) : "",
  }
}

function toStorageProxyUrl(bucket: string, objectPath: string, encodedVersion: string) {
  const encodedPath = objectPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  const baseUrl = `/api/storage/public/${encodeURIComponent(bucket)}/${encodedPath}`

  return encodedVersion ? `${baseUrl}?v=${encodedVersion}` : baseUrl
}
