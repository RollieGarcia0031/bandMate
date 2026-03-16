"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Users, Headphones, Guitar } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-6">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">10,000+ musicians connected</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight text-balance">
              Find Your Perfect
              <span className="block text-primary">Musical Match</span>
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 text-pretty">
              Swipe, match, and jam. BandMate connects you with musicians who share your vibe, 
              genre, and ambition. Your next great collaboration is just a swipe away.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button size="lg" asChild className="text-base">
                <Link href="/signup">
                  Start Matching
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" className="text-base">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-3 gap-8 pt-8 border-t border-border">
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">50K+</div>
                <div className="text-sm text-muted-foreground">Active Musicians</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">15K+</div>
                <div className="text-sm text-muted-foreground">Bands Formed</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">100+</div>
                <div className="text-sm text-muted-foreground">Genres</div>
              </div>
            </div>
          </div>

          {/* Right Content - Profile Cards Stack */}
          <div className="relative h-[500px] flex items-center justify-center">
            {/* Background Card */}
            <div className="absolute w-72 h-96 rounded-2xl bg-card border border-border rotate-6 translate-x-8 shadow-2xl">
              <div className="h-48 bg-secondary rounded-t-2xl flex items-center justify-center">
                <Headphones className="h-16 w-16 text-muted-foreground" />
              </div>
            </div>

            {/* Middle Card */}
            <div className="absolute w-72 h-96 rounded-2xl bg-card border border-border -rotate-3 -translate-x-4 shadow-2xl">
              <div className="h-48 bg-secondary rounded-t-2xl flex items-center justify-center">
                <Guitar className="h-16 w-16 text-muted-foreground" />
              </div>
            </div>

            {/* Front Card */}
            <div className="relative w-72 h-96 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
              <div className="h-48 bg-primary/20 flex items-center justify-center">
                <Users className="h-16 w-16 text-primary" />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">Sarah M.</h3>
                  <span className="text-primary">26</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Lead Vocalist • 3 miles away</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">Rock</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-accent/20 text-accent-foreground">Indie</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground">Alt</span>
                </div>
                <p className="text-sm text-foreground mt-4">
                  Looking for a band to create something raw and real. Let&apos;s make music that matters.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6">
                <button className="h-14 w-14 rounded-full border-2 border-destructive flex items-center justify-center hover:bg-destructive/10 transition-colors">
                  <X className="h-6 w-6 text-destructive" />
                </button>
                <button className="h-14 w-14 rounded-full border-2 border-primary flex items-center justify-center hover:bg-primary/10 transition-colors">
                  <Heart className="h-6 w-6 text-primary" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function Heart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}
