"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Music, ArrowRight, ArrowLeft, Check, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const GENRES = [
  "Rock", "Metal", "Jazz", "Blues", "Classical", "Hip-Hop",
  "R&B", "Electronic", "Pop", "Folk", "Country", "Reggae",
  "Punk", "Indie", "Soul", "Funk",
]

const INSTRUMENTS = [
  "Guitar", "Bass", "Drums", "Piano / Keys", "Vocals", "Violin",
  "Cello", "Trumpet", "Saxophone", "Flute", "DJ / Turntables", "Producer",
  "Ukulele", "Mandolin", "Banjo", "Other",
]

const GOALS = [
  { label: "Form a band", description: "Find members for a full project" },
  { label: "Collaborate", description: "Create music together remotely or in-person" },
  { label: "Jam sessions", description: "Casual playing with other musicians" },
  { label: "Find a teacher", description: "Learn from experienced players" },
  { label: "Teach", description: "Share your skills with others" },
  { label: "Tour & perform", description: "Hit the stage together" },
]

const TOTAL_STEPS = 4

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
              i + 1 < currentStep
                ? "bg-primary text-primary-foreground"
                : i + 1 === currentStep
                ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {i + 1 < currentStep ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          {i < TOTAL_STEPS - 1 && (
            <div
              className={`h-px w-8 transition-all duration-300 ${
                i + 1 < currentStep ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

interface FormData {
  // Step 1
  name: string
  email: string
  password: string
  confirmPassword: string
  // Step 2
  instruments: string[]
  genres: string[]
  // Step 3
  goals: string[]
  // Step 4
  bio: string
  location: string
  experience: string
}

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    instruments: [],
    genres: [],
    goals: [],
    bio: "",
    location: "",
    experience: "",
  })

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleArrayItem(key: "instruments" | "genres" | "goals", item: string) {
    setFormData((prev) => {
      const arr = prev[key] as string[]
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      }
    })
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validateStep(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = "Full name is required."
      if (!formData.email.trim()) newErrors.email = "Email is required."
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Enter a valid email address."
      if (!formData.password) newErrors.password = "Password is required."
      else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters."
      if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm your password."
      else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match."
    }

    if (step === 2) {
      if (formData.instruments.length === 0) newErrors.instruments = "Select at least one instrument."
      if (formData.genres.length === 0) newErrors.genres = "Select at least one genre."
    }

    if (step === 3) {
      if (formData.goals.length === 0) newErrors.goals = "Select at least one goal."
    }

    if (step === 4) {
      if (!formData.location.trim()) newErrors.location = "Location is required."
      if (!formData.experience) newErrors.experience = "Select your experience level."
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleNext() {
    if (validateStep()) {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS))
    }
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1))
  }

  function handleSubmit() {
    if (!validateStep()) return
    // Supabase auth will be wired in later
    router.push("/")
  }

  const stepLabels = ["Account", "Your Sound", "Your Goals", "About You"]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-2/5 bg-card border-r border-border flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/3 -left-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-64 h-64 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Music className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">BandMate</span>
        </Link>

        <div>
          <blockquote className="text-2xl font-semibold text-foreground leading-snug text-pretty">
            "Found my bassist and best friend on BandMate. We released our first EP six months later."
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              JR
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Jordan R.</p>
              <p className="text-xs text-muted-foreground">Guitarist, Indie Rock</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {["50K+ active musicians", "100+ genres covered", "15K+ bands formed"].map((stat) => (
            <div key={stat} className="flex items-center gap-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">{stat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
            <Music className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">BandMate</span>
        </div>

        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="mb-8">
            <p className="text-sm text-muted-foreground mb-1">
              Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}
            </p>
            <StepIndicator currentStep={step} />
          </div>

          {/* Step 1 — Account Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
                <p className="text-muted-foreground mt-1">Start finding your musical match today.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    placeholder="Alex Rivera"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="alex@example.com"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={formData.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repeat your password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateField("confirmPassword", e.target.value)}
                      className={`pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Musical Identity */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Your sound</h1>
                <p className="text-muted-foreground mt-1">Tell us what you play and what moves you.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>What do you play? <span className="text-muted-foreground font-normal">(select all that apply)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {INSTRUMENTS.map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => toggleArrayItem("instruments", inst)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                          formData.instruments.includes(inst)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {inst}
                      </button>
                    ))}
                  </div>
                  {errors.instruments && <p className="text-xs text-destructive">{errors.instruments}</p>}
                </div>

                <div className="space-y-3">
                  <Label>Genres you love <span className="text-muted-foreground font-normal">(select all that apply)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleArrayItem("genres", genre)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                          formData.genres.includes(genre)
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-secondary text-secondary-foreground border-border hover:border-accent/50"
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                  {errors.genres && <p className="text-xs text-destructive">{errors.genres}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Goals */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">What are you looking for?</h1>
                <p className="text-muted-foreground mt-1">We'll show you the most relevant matches.</p>
              </div>

              <div className="space-y-3">
                {GOALS.map(({ label, description }) => {
                  const selected = formData.goals.includes(label)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleArrayItem("goals", label)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all duration-150 ${
                        selected
                          ? "bg-primary/10 border-primary"
                          : "bg-card border-border hover:border-primary/40"
                      }`}
                    >
                      <div>
                        <p className={`font-semibold text-sm ${selected ? "text-primary" : "text-foreground"}`}>
                          {label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                          selected ? "bg-primary border-primary" : "border-border"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </button>
                  )
                })}
                {errors.goals && <p className="text-xs text-destructive">{errors.goals}</p>}
              </div>
            </div>
          )}

          {/* Step 4 — About You */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">About you</h1>
                <p className="text-muted-foreground mt-1">Help others get to know you before swiping.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g. Austin, TX"
                    value={formData.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    className={errors.location ? "border-destructive" : ""}
                  />
                  {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Experience level</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Beginner", "Intermediate", "Advanced"].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => updateField("experience", level)}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 ${
                          formData.experience === level
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  {errors.experience && <p className="text-xs text-destructive">{errors.experience}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">
                    Bio <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <textarea
                    id="bio"
                    rows={4}
                    placeholder="Tell other musicians a bit about yourself, your influences, and what you're working on..."
                    value={formData.bio}
                    onChange={(e) => updateField("bio", e.target.value)}
                    maxLength={300}
                    className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">{formData.bio.length}/300</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-4">
            {step > 1 ? (
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <Button onClick={handleNext} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="gap-2">
                Create Account
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Login link */}
          {step === 1 && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
