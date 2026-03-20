"use client"

import { useState } from "react"
import { Upload, X, Globe, Lock, Users, Play } from "lucide-react"
import { cn } from "@/lib/utils"

type Visibility = "public" | "private" | "followers"

interface Post {
  id: string
  title: string
  description: string
  visibility: Visibility
  videoUrl: string
  createdAt: string
  views: number
  likes: number
}

// Mock posts - will be replaced with Supabase data
const mockPosts: Post[] = [
  {
    id: "1",
    title: "Studio Session - Jazz Improvisation",
    description: "A quick jam session exploring jazz harmonies and improvisation techniques on the piano.",
    visibility: "public",
    videoUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=800&fit=crop",
    createdAt: "2 days ago",
    views: 245,
    likes: 32,
  },
  {
    id: "2",
    title: "New Beat Production",
    description: "Working on a new hip-hop beat with vintage drum samples.",
    visibility: "followers",
    videoUrl: "https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=500&h=800&fit=crop",
    createdAt: "1 week ago",
    views: 156,
    likes: 18,
  },
  {
    id: "3",
    title: "Guitar Riff Practice",
    description: "Daily practice routine for my upcoming project.",
    visibility: "private",
    videoUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=500&h=800&fit=crop",
    createdAt: "3 weeks ago",
    views: 0,
    likes: 0,
  },
]

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>(mockPosts)
  const [isCreating, setIsCreating] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("public")

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoPreview(url)
    } else {
      alert("Please select a valid video file")
    }
  }

  const handleCreatePost = () => {
    if (!videoFile || !title.trim()) {
      alert("Please select a video and enter a title")
      return
    }

    const newPost: Post = {
      id: Date.now().toString(),
      title,
      description,
      visibility,
      videoUrl: videoPreview || "",
      createdAt: "just now",
      views: 0,
      likes: 0,
    }

    setPosts([newPost, ...posts])
    resetForm()
  }

  const resetForm = () => {
    setVideoFile(null)
    setVideoPreview(null)
    setTitle("")
    setDescription("")
    setVisibility("public")
    setIsCreating(false)
  }

  const getVisibilityIcon = (vis: Visibility) => {
    switch (vis) {
      case "public":
        return <Globe className="w-4 h-4" />
      case "private":
        return <Lock className="w-4 h-4" />
      case "followers":
        return <Users className="w-4 h-4" />
    }
  }

  const getVisibilityLabel = (vis: Visibility) => {
    return vis.charAt(0).toUpperCase() + vis.slice(1)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground">My Posts</h1>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Create Post Section */}
        <div className="p-4 lg:p-6">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              <Upload className="w-5 h-5" />
              Create New Post
            </button>
          ) : (
            <div className="space-y-4 bg-card rounded-xl p-6 border border-border">
              {/* Video Upload Area */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  Upload Video
                </label>
                {videoPreview ? (
                  <div className="relative bg-secondary rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                    <video
                      src={videoPreview}
                      className="w-full h-full object-cover"
                      controls
                    />
                    <button
                      onClick={() => {
                        setVideoFile(null)
                        setVideoPreview(null)
                      }}
                      className="absolute top-2 right-2 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
                    >
                      <X className="w-5 h-5 text-foreground" />
                    </button>
                  </div>
                ) : (
                  <label className="block w-full aspect-video bg-secondary rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors flex items-center justify-center">
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-foreground font-medium">Click to upload video</p>
                      <p className="text-sm text-muted-foreground">MP4, WebM, etc.</p>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Title
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.slice(0, 100))}
                    placeholder="Enter post title"
                    maxLength={100}
                    className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                    {title.length}/100
                  </span>
                </div>
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Description
                </label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                    placeholder="Enter post description (optional)"
                    maxLength={500}
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                  <span className="absolute right-3 bottom-2.5 text-xs text-muted-foreground">
                    {description.length}/500
                  </span>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  Visibility
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["public", "private", "followers"] as const).map((vis) => (
                    <button
                      key={vis}
                      onClick={() => setVisibility(vis)}
                      className={cn(
                        "flex flex-col items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all",
                        visibility === vis
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {getVisibilityIcon(vis)}
                      <span className="text-sm font-medium">
                        {getVisibilityLabel(vis)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 rounded-lg bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePost}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                >
                  Create Post
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4 lg:px-6 pb-8">
          {posts.length > 0 ? (
            posts.map((post) => (
              <div
                key={post.id}
                className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary transition-colors"
              >
                {/* Video Thumbnail */}
                <div className="relative aspect-video bg-secondary overflow-hidden">
                  <img
                    src={post.videoUrl}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-12 h-12 text-white fill-white" />
                  </div>
                  {/* Visibility Badge */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-background/80 backdrop-blur-sm text-foreground text-xs font-medium">
                    {getVisibilityIcon(post.visibility)}
                    {getVisibilityLabel(post.visibility)}
                  </div>
                </div>

                {/* Post Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {post.description || "No description"}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                    <span>{post.createdAt}</span>
                    <div className="flex gap-3">
                      <span>{post.views} views</span>
                      <span>{post.likes} likes</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-20 px-4">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Upload className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No posts yet
              </h3>
              <p className="text-muted-foreground text-center">
                Create your first post to showcase your music
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
