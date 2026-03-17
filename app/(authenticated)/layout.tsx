import { AppSidebar } from "@/components/app/app-sidebar"
import { AppBottomNav } from "@/components/app/app-bottom-nav"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
