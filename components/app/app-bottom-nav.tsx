"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, MessageCircle, User, Video } from "lucide-react"

const navItems = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/me", label: "Me", icon: User },
  { href: "/posts", label: "Posts", icon: Video },
]

export function AppBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-pb">
      <ul className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`
                  flex flex-col items-center justify-center gap-1 py-2 transition-colors
                  ${isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <item.icon className={`w-6 h-6 ${isActive && "scale-110"}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
