import { Quote } from "lucide-react"

const testimonials = [
  {
    quote: "Found my entire band through BandMate. We've been touring for 8 months now and it all started with a swipe.",
    name: "Marcus Chen",
    role: "Guitarist, The Midnight Echo",
    initials: "MC"
  },
  {
    quote: "As a producer, I was struggling to find vocalists who matched my style. BandMate changed everything.",
    name: "Alex Rivera",
    role: "Producer & Beatmaker",
    initials: "AR"
  },
  {
    quote: "I moved to a new city and had zero musical connections. Within a week, I had 5 jam sessions lined up.",
    name: "Jordan Lee",
    role: "Bassist",
    initials: "JL"
  }
]

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24 bg-card">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Success Stories
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Musicians all over the world are forming bands, collaborating, and creating amazing music through BandMate.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="p-6 rounded-2xl bg-background border border-border"
            >
              <Quote className="h-8 w-8 text-primary/40 mb-4" />
              <p className="text-foreground mb-6">&ldquo;{testimonial.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">{testimonial.initials}</span>
                </div>
                <div>
                  <div className="font-semibold text-foreground">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
