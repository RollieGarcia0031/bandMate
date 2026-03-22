"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, MessageCircle, User, Music2, Video } from "lucide-react"
import { useProfile } from "@/hooks/use-profile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const navItems = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/me", label: "Me", icon: User },
  { href: "/posts", label: "Posts", icon: Video },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { profile, loading } = useProfile()

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-card border-r border-border fixed left-0 top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
          <Music2 className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">BandMate</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200
                    ${isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }
                  `}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-lg font-medium">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-border">
        {loading ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ) : (
          <Link 
            href="/me"
            className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border">
              <User className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {profile?.displayName || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.username ? `@${profile.username}` : "Profile not set"}
              </p>
            </div>
          </Link>
        )}
      </div>
    </aside>
  )
}
