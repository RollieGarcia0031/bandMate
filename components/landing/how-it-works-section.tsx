const steps = [
  {
    number: "01",
    title: "Create Your Profile",
    description: "Sign up and build your musician profile. Add your instruments, genres, influences, and upload samples of your work."
  },
  {
    number: "02",
    title: "Discover Musicians",
    description: "Swipe through profiles of musicians near you. Listen to their tracks, see their experience, and find your vibe match."
  },
  {
    number: "03",
    title: "Match & Connect",
    description: "When you both swipe right, it's a match! Start chatting, share ideas, and plan your first jam session."
  },
  {
    number: "04",
    title: "Make Music Together",
    description: "Meet up, collaborate remotely, or form a band. Your next musical journey starts with a single swipe."
  }
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-background">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            How BandMate Works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Finding your musical match is simple. Here&apos;s how it works.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border -translate-x-4" />
              )}
              
              <div className="text-6xl font-bold text-primary/20 mb-4">{step.number}</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
