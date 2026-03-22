# Custom Hooks

This document provides a brief overview of the custom React hooks used across the BandMate application.

## `useIsMobile`
**Location:** `hooks/use-mobile.ts`

Detects if the current viewport width is below the mobile breakpoint (768px). It listens for window resize events and returns a boolean indicating the mobile state.

## `useProfile`
**Location:** `hooks/use-profile.ts`

Fetches and manages the authenticated user's profile data from Supabase. It returns the `profile` object (including `id`, `username`, `displayName`, and `avatar`) along with a `loading` state.

## `useToast`
**Location:** `hooks/use-toast.ts`

A hook for managing toast notifications. It provides access to the current active toasts and functions to trigger (`toast`), update, or dismiss them. This is integrated with the Radix UI Toast component.
