import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const urlToken = request.nextUrl.searchParams.get("token")
  const headerToken = request.headers.get("x-keep-alive-token")
  const expectedToken = process.env.KEEP_ALIVE_TOKEN

  if (expectedToken) {
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null
    const providedToken = bearerToken || headerToken || urlToken

    if (providedToken !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient()

    const now = new Date().toISOString()

    const { error } = await supabase
      .from("keep_alive")
      .insert({ updated_at: now })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { message: "Keep-alive updated successfully", timestamp: now },
      { status: 200 }
    )
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
