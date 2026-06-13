-- ═══════════════════════════════════════════════════════════════════════════════
-- 🛡️ BEIDAR POS - SUPABASE SETUP & SCHEMA CONFIGURATION
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard > SQL Editor.
-- 2. Create a "New Query", paste this entire script, and run it.
-- 3. This script will create all necessary tables, constraints, RLS policies, 
--    and the public.get_user_by_id stored procedure.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. CREATE TABLES

-- A. global_settings table
CREATE TABLE IF NOT EXISTS public.global_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- B. licenses table
CREATE TABLE IF NOT EXISTS public.licenses (
    id serial PRIMARY KEY,
    license_key varchar(50) UNIQUE NOT NULL,
    status varchar(20) DEFAULT 'active',
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    bound_at timestamptz,
    store_name varchar(255),
    customer_name varchar(255),
    customer_phone varchar(50),
    expires_at timestamptz,
    features jsonb,
    last_check_in timestamptz,
    app_version varchar(20),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- C. app_admins table
CREATE TABLE IF NOT EXISTS public.app_admins (
    id serial PRIMARY KEY,
    username varchar UNIQUE NOT NULL,
    password_hash varchar NOT NULL,
    last_login timestamptz,
    created_at timestamptz DEFAULT now()
);

-- D. admin_logs table
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id serial PRIMARY KEY,
    admin_username varchar,
    action varchar,
    target_license varchar,
    details text,
    created_at timestamptz DEFAULT now()
);

-- E. active_sessions table
CREATE TABLE IF NOT EXISTS public.active_sessions (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    session_token text NOT NULL,
    device_name text,
    last_seen timestamptz,
    created_at timestamptz DEFAULT now()
);

-- F. user_backups table
CREATE TABLE IF NOT EXISTS public.user_backups (
    id text PRIMARY KEY,
    backup_id text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    store_name text,
    chunk_index integer NOT NULL,
    total_chunks integer NOT NULL,
    total_size integer NOT NULL,
    data text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. DEFINE RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- A. licenses policies
CREATE POLICY "Public Read Access" ON public.licenses
    FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Admin Full Access" ON public.licenses
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- B. admin_logs policies
CREATE POLICY "Admin Logs Access" ON public.admin_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- C. app_admins policies
CREATE POLICY "Admin Table Access" ON public.app_admins
    FOR SELECT TO service_role USING (true);

CREATE POLICY "Public Read Password Hashes" ON public.app_admins
    FOR SELECT TO anon USING (true);

-- D. active_sessions policies
CREATE POLICY "Allow select active sessions" ON public.active_sessions
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Allow insert/update/delete active sessions" ON public.active_sessions
    FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- E. user_backups policies
CREATE POLICY "Allow full access to own backups" ON public.user_backups
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin access to backups" ON public.user_backups
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- F. global_settings policies
CREATE POLICY "Public Read Settings" ON public.global_settings
    FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Admin Write Settings" ON public.global_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. CREATE STORED PROCEDURES (RPC)
-- ═══════════════════════════════════════════════════════════════════════════════

-- A. get_user_by_id function
-- This allows the admin interface (via API) to retrieve user registration info
-- (e.g. Email and CreatedAt) from the private auth.users table.
CREATE OR REPLACE FUNCTION public.get_user_by_id(user_id uuid)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(u) INTO result FROM auth.users u WHERE u.id = user_id;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SEED DEFAULT DEVELOPER CREDENTIALS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Inserts default admin username 'wisam' with password 'beidar2026' (bcrypt hash).
-- Change this password immediately after setup if running in production.
INSERT INTO public.app_admins (username, password_hash) 
VALUES ('wisam', '$2a$10$bjc01RdJBE8UdEwc1A2XL.g2raNczLqgpMQY5eZMm.8Y9EKk032tu')
ON CONFLICT (username) DO NOTHING;
