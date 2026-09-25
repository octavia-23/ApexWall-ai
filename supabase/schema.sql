-- =========================================================================
-- PITWALL AI // SUPABASE DATABASE SCHEMA
-- Table: pitwall_setups
-- Purpose: Cloud-synced setups, public shareable setups, and team access.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.pitwall_setups (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    game TEXT NOT NULL,
    car TEXT NOT NULL,
    track TEXT NOT NULL,
    session_type TEXT,
    weather TEXT,
    track_temp TEXT,
    air_temp TEXT,
    tyre_compound TEXT,
    fuel_load TEXT,
    lap_time TEXT,
    driver_style TEXT,
    summary TEXT,
    engineer_notes TEXT,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT true,
    share_slug TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for fast search and user querying
CREATE INDEX IF NOT EXISTS idx_pitwall_setups_user ON public.pitwall_setups(user_id);
CREATE INDEX IF NOT EXISTS idx_pitwall_setups_slug ON public.pitwall_setups(share_slug);
CREATE INDEX IF NOT EXISTS idx_pitwall_setups_public ON public.pitwall_setups(is_public);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pitwall_setups ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone can read setups marked as public
CREATE POLICY "Public setups are viewable by anyone"
ON public.pitwall_setups
FOR SELECT
USING (is_public = true);

-- Policy 2: Authenticated users can read all their own setups (public or private)
CREATE POLICY "Users can view their own setups"
ON public.pitwall_setups
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 3: Authenticated users can insert their own setups
CREATE POLICY "Users can insert their own setups"
ON public.pitwall_setups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can update their own setups
CREATE POLICY "Users can update their own setups"
ON public.pitwall_setups
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 5: Users can delete their own setups
CREATE POLICY "Users can delete their own setups"
ON public.pitwall_setups
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
