import { Music, Users, Zap, MapPin, MessageCircle, Shield } from "lucide-react"

const features = [
  {
    icon: Music,
    title: "Genre Matching",
    description: "Our algorithm matches you with musicians who share your musical taste and style preferences."
  },
  {
    icon: Users,
    title: "Band Building",
    description: "Looking for a drummer? A bassist? Find the missing piece to complete your dream lineup."
  },
  {
    icon: Zap,
    title: "Instant Connection",
    description: "When you both swipe right, you can instantly chat, share tracks, and plan your first jam session."
  },
  {
    icon: MapPin,
    title: "Local Discovery",
    description: "Find musicians in your area for in-person rehearsals and live performances."
  },
  {
    icon: MessageCircle,
    title: "Audio Messages",
    description: "Share voice notes, song snippets, and riffs directly in chat to showcase your sound."
  },
  {
    icon: Shield,
    title: "Verified Profiles",
    description: "Connect with confidence knowing profiles are verified through linked social and streaming accounts."
  }
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-card">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Everything You Need to Find Your Sound
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            BandMate is packed with features designed specifically for musicians looking to connect and collaborate.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors group"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
