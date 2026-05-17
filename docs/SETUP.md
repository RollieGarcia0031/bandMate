# Project Setup Guide

This guide provides step-by-step instructions to get the BandMate project up and running on your local machine.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## 1. Clone the Repository

```bash
git clone <repository-url>
cd BandMate
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Environment Variables

Copy the example environment file and fill in the required values.

```bash
cp .env.example .env
```

Open `.env` and provide your Supabase project details:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (found in Project Settings > API).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous API key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (keep this secret!).
- `NEXT_PUBLIC_SUPABASE_PROFILE_PHOTOS_BUCKET`: `profile-photos`
- `NEXT_PUBLIC_SUPABASE_USER_POSTS_BUCKET`: `user-posts`

## 4. Supabase Database & Storage Setup

The project uses a consolidated migration file to initialize everything at once, including tables, RLS policies, and storage buckets.

### Step 4.1: Link your project
If you haven't already, create a new project in the [Supabase Dashboard](https://supabase.com/dashboard). Then link it to your local CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

### Step 4.2: Push Migrations
Apply the consolidated initialization migration to your remote project. This will create all necessary tables and the required storage buckets (`profile-photos` and `user-posts`).

```bash
npx supabase db push
```

## 5. Running the Application

Start the development server:

```bash
npm run dev
```

The application should now be running at [http://localhost:3000](http://localhost:3000).

---

## Troubleshooting

### Storage Buckets Not Found
If the application reports that buckets are missing, ensure that `npx supabase db push` was executed successfully. The creation logic is embedded in the `00000000000000_init.sql` migration.

### Auth Redirects
Ensure your site URL and redirect URIs are correctly configured in the Supabase Dashboard under **Authentication > URL Configuration**. For local development, this usually includes `http://localhost:3000`.
