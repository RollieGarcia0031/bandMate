import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseServerEnv } from "@/lib/supabase/env"

const AUTH_ENTRY_ROUTES = new Set(["/", "/login", "/signup"])
const PROTECTED_ROUTE_PREFIXES = ["/feed", "/inbox", "/me", "/search", "/settings"]

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  const { url, anonKey } = getSupabaseServerEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(
        cookiesToSet: Array<{
          name: string
          value: string
          options?: Parameters<typeof response.cookies.set>[2]
        }>,
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthEntryRoute = AUTH_ENTRY_ROUTES.has(pathname)
  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (user && isAuthEntryRoute) {
    return NextResponse.redirect(new URL("/feed", request.url))
  }

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
