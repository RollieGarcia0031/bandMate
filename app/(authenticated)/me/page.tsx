import type { ReactNode } from "react"
import Link from "next/link"
import { Calendar, Edit, MapPin, Music, Settings, Sparkles, UserRound, Waves, Youtube } from "lucide-react"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getCurrentUserProfile } from "@/lib/profile/current-user-profile"

export default async function MePage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const profile = await getCurrentUserProfile(user.id)
  const heroSubtitle = buildHeroSubtitle(profile)
  const joinedLabel = profile.joinedDate ? format(new Date(profile.joinedDate), "MMMM yyyy") : null
  const profileCompletion = calculateProfileCompletion(profile)

  return (
    <div className="min-h-screen pb-8">
      <div className="relative overflow-hidden border-b border-border bg-card">
        <div className="h-52 bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.25),_transparent_45%),radial-gradient(circle_at_top_right,_hsl(var(--accent)/0.2),_transparent_40%),linear-gradient(135deg,_hsl(var(--secondary)),_hsl(var(--background)))]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 lg:p-6">
          <div className="rounded-full border border-white/20 bg-background/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            Live profile from Supabase
          </div>
          <Link
            href="/settings"
            className="rounded-full border border-white/20 bg-background/70 p-2 backdrop-blur-sm transition-colors hover:bg-background"
          >
            <Settings className="h-5 w-5 text-foreground" />
          </Link>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-6 lg:px-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-end">
              <Avatar className="h-32 w-32 border-4 border-background shadow-xl lg:h-36 lg:w-36">
                <AvatarImage src={profile.avatar} alt={profile.displayName} className="object-cover" />
                <AvatarFallback className="text-3xl font-semibold">
                  {getInitials(profile.displayName)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-3 text-center lg:text-left">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    {profile.displayName}
                    {profile.age !== null ? `, ${profile.age}` : ""}
                  </h1>
                  <p className="text-sm text-muted-foreground">{profile.username ? `@${profile.username}` : profile.email}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm lg:justify-start">
                  {heroSubtitle.map((item) => (
                    <span key={item} className="rounded-full border border-border bg-background/80 px-3 py-1 text-foreground/90 backdrop-blur-sm">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/settings">
                <Button className="w-full gap-2 sm:w-auto">
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-4xl gap-6 px-4 lg:grid-cols-[1.6fr_1fr] lg:px-8">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">About</h2>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {profile.bio || "Add a bio in Settings so other musicians can quickly understand your sound, goals, and vibe."}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Musical identity</h2>
            </div>

            <div className="space-y-5">
              <ProfileTagGroup title="Instruments" items={profile.instruments} emptyLabel="No instruments added yet" tone="primary" />
              <ProfileTagGroup title="Genres" items={profile.genres} emptyLabel="No genres added yet" tone="secondary" />
              <ProfileTagGroup title="Looking for" items={profile.lookingFor} emptyLabel="No collaboration goals selected yet" tone="accent" />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Profile snapshot</h2>
            </div>

            <div className="space-y-4 text-sm">
              <SnapshotRow icon={MapPin} label="Location" value={profile.city || "Add your city"} />
              <SnapshotRow icon={Calendar} label="Joined" value={joinedLabel ? `Joined ${joinedLabel}` : "Join date unavailable"} />
              <SnapshotRow icon={Music} label="Experience" value={formatExperience(profile)} />
              <SnapshotRow icon={Waves} label="Profile completion" value={`${profileCompletion}% complete`} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Links</h2>
            <div className="mt-4 space-y-3">
              <ProfileLink href={profile.spotifyUrl} label="Spotify" />
              <ProfileLink href={profile.youtubeUrl} label="YouTube" icon={<Youtube className="h-4 w-4" />} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function ProfileTagGroup({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string
  items: string[]
  emptyLabel: string
  tone: "primary" | "secondary" | "accent"
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary text-secondary-foreground border-border",
    accent: "bg-accent/10 text-accent-foreground border-accent/30",
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className={`rounded-full border px-3 py-1.5 text-sm ${toneClasses[tone]}`}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}

function SnapshotRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-full bg-secondary p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}

function ProfileLink({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon?: ReactNode
}) {
  if (!href) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        {label} not connected yet
      </div>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-muted-foreground">Open</span>
    </a>
  )
}

function buildHeroSubtitle(profile: Awaited<ReturnType<typeof getCurrentUserProfile>>) {
  return [profile.city, profile.experienceLevel, profile.gender].filter(Boolean).slice(0, 3)
}

function formatExperience(profile: Awaited<ReturnType<typeof getCurrentUserProfile>>) {
  if (!profile.experienceLevel && !profile.experienceYears) {
    return "Add your experience details"
  }

  if (profile.experienceLevel && profile.experienceYears) {
    return `${profile.experienceLevel} • ${profile.experienceYears} year${profile.experienceYears === 1 ? "" : "s"}`
  }

  if (profile.experienceLevel) {
    return profile.experienceLevel
  }

  return `${profile.experienceYears} year${profile.experienceYears === 1 ? "" : "s"}`
}

function calculateProfileCompletion(profile: Awaited<ReturnType<typeof getCurrentUserProfile>>) {
  const fields = [
    profile.avatar,
    profile.bio,
    profile.city,
    profile.birthday,
    profile.experienceLevel,
    profile.spotifyUrl,
    profile.youtubeUrl,
    profile.instruments.length > 0 ? "yes" : "",
    profile.genres.length > 0 ? "yes" : "",
    profile.lookingFor.length > 0 ? "yes" : "",
  ]

  const completed = fields.filter(Boolean).length
  return Math.round((completed / fields.length) * 100)
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "BM"
}
