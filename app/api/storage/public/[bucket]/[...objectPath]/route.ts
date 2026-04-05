import { getSupabaseObjectCacheControlPolicy } from "@/lib/supabase/storage-cache-control"
import { getSupabaseServerEnv } from "@/lib/supabase/env"

export async function GET(
  request: Request,
  context: { params: Promise<{ bucket: string; objectPath: string[] }> },
) {
  const { bucket, objectPath } = await context.params

  if (!bucket || !objectPath || objectPath.length === 0) {
    return new Response("Missing storage object path.", { status: 400 })
  }

  const upstreamUrl = buildSupabasePublicStorageUrl(bucket, objectPath, request.url)
  const upstreamResponse = await fetch(upstreamUrl)

  if (!upstreamResponse.ok) {
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: {
        "cache-control": "no-store",
      },
    })
  }

  const responseHeaders = new Headers()
  copyHeaderIfPresent(upstreamResponse.headers, responseHeaders, "content-type")
  copyHeaderIfPresent(upstreamResponse.headers, responseHeaders, "content-length")
  copyHeaderIfPresent(upstreamResponse.headers, responseHeaders, "etag")
  copyHeaderIfPresent(upstreamResponse.headers, responseHeaders, "last-modified")
  copyHeaderIfPresent(upstreamResponse.headers, responseHeaders, "accept-ranges")

  responseHeaders.set("cache-control", getSupabaseObjectCacheControlPolicy(new URL(request.url)))

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  })
}

function buildSupabasePublicStorageUrl(bucket: string, objectPath: string[], requestUrl: string) {
  const { url } = getSupabaseServerEnv()
  const parsedRequestUrl = new URL(requestUrl)
  const sanitizedPath = objectPath.map((segment) => encodeURIComponent(segment)).join("/")

  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${sanitizedPath}${parsedRequestUrl.search}`
}

function copyHeaderIfPresent(source: Headers, target: Headers, headerName: string) {
  const value = source.get(headerName)

  if (value) {
    target.set(headerName, value)
  }
}
