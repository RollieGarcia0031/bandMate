import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app/app-sidebar"
import { AppBottomNav } from "@/components/app/app-bottom-nav"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <AppSidebar />
      
      {/* Main Content Area */}
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        {children}
      </main>
      
      {/* Mobile Bottom Nav */}
      <AppBottomNav />
    </div>
  )
}
