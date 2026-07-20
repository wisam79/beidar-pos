-- =========================================================================
-- BEIDAR ADMIN SECURITY SETUP
-- =========================================================================
-- This script sets up Row Level Security (RLS) on the licenses and admin_logs
-- tables so they can be securely managed from a standalone admin portal
-- without exposing the master service_role_key.
-- =========================================================================

-- Drop the old, deprecated app_admins table (which had username/password_hash columns)
DROP TABLE IF EXISTS public.app_admins CASCADE;

-- 1. Create the new app_admins table linked to auth.users
CREATE TABLE public.app_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on app_admins (only admins should see who else is an admin)
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admins" ON public.app_admins
    FOR SELECT TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.app_admins));

-- 2. Configure RLS and Policies for 'licenses' table
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Policy: Normal authenticated cashiers/store-owners can view ONLY their own bound license
CREATE POLICY "Users can read own license" ON public.licenses
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Admins can perform any action (select, insert, update, delete) on any license
CREATE POLICY "Admins have full access to licenses" ON public.licenses
    FOR ALL TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.app_admins))
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.app_admins));

-- 3. Configure RLS and Policies for 'admin_logs' table
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view and insert admin logs
CREATE POLICY "Admins can read logs" ON public.admin_logs
    FOR SELECT TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.app_admins));

CREATE POLICY "Admins can write logs" ON public.admin_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.app_admins));

-- 4. Database Trigger for Feature Metadata Synchronization
-- This replaces the Go backend "syncUserFeaturesFromLicense" logic.
-- When an admin modifies features in the licenses table, this trigger
-- automatically syncs those changes to auth.users raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.sync_user_features_from_license()
RETURNS TRIGGER AS $$
DECLARE
    enable_ai BOOLEAN := FALSE;
    enable_lan BOOLEAN := FALSE;
    enable_whatsapp BOOLEAN := FALSE;
BEGIN
    -- Only sync if license status is active and user is bound
    IF NEW.status = 'active' AND NEW.user_id IS NOT NULL THEN
        IF NEW.features->>'ai_features' = 'true' THEN
            enable_ai := TRUE;
        END IF;
        IF NEW.features->>'cloud_sync' = 'true' THEN
            enable_lan := TRUE;
        END IF;
        IF NEW.features->>'whatsapp_integration' = 'true' THEN
            enable_whatsapp := TRUE;
        END IF;
    END IF;

    -- Update metadata in auth.users
    UPDATE auth.users
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'enable_ai', enable_ai,
            'enable_lan', enable_lan,
            'enable_whatsapp', enable_whatsapp
        )
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS tr_sync_user_features ON public.licenses;

-- Create the trigger
CREATE TRIGGER tr_sync_user_features
    AFTER INSERT OR UPDATE OF status, user_id, features
    ON public.licenses
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_features_from_license();

-- 5. Configure RLS and Policies for 'global_settings' table
CREATE POLICY "Admins have full access to global_settings" ON public.global_settings
    FOR ALL TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.app_admins))
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.app_admins));

-- =========================================================================
-- SEED INITIAL ADMIN USER
-- =========================================================================
-- SECURITY NOTE: The admin account must NOT be created with hardcoded
-- credentials in version control. Create the first admin interactively via
-- the Supabase Dashboard (Authentication > Users) or run this block
-- AFTER replacing the placeholders below with a strong, unique password.
--
-- Steps:
--   1. Set :admin_email and :admin_pass to real values (use psql variables
--      or Supabase SQL Editor's "Run" with substitution disabled).
--   2. Run this block ONCE.
--   3. Change the password immediately after first login.
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    -- Replace these placeholders BEFORE running. Never commit real values.
    admin_email TEXT := 'CHANGE_ME@example.com';
    admin_pass  TEXT := 'CHANGE_ME_STRONG_PASSWORD';
    admin_user  TEXT := 'admin';
BEGIN
    IF admin_email = 'CHANGE_ME@example.com' OR admin_pass = 'CHANGE_ME_STRONG_PASSWORD' THEN
        RAISE NOTICE 'Admin seed skipped: please replace the placeholder email/password in this block before running.';
        RETURN;
    END IF;

    -- Check if user already exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            is_super_admin
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            new_user_id,
            'authenticated',
            'authenticated',
            admin_email,
            crypt(admin_pass, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            now(),
            now(),
            false
        );

        -- Add user as admin in app_admins table
        INSERT INTO public.app_admins (user_id, username)
        VALUES (new_user_id, admin_user);
        
        RAISE NOTICE 'Admin user created successfully with ID %', new_user_id;
    ELSE
        -- If the user exists in auth.users, just link them to public.app_admins
        SELECT id INTO new_user_id FROM auth.users WHERE email = admin_email;
        
        IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = new_user_id) THEN
            INSERT INTO public.app_admins (user_id, username)
            VALUES (new_user_id, admin_user);
            RAISE NOTICE 'Existing user linked to app_admins successfully.';
        ELSE
            RAISE NOTICE 'User is already an admin.';
        END IF;
    END IF;
END $$;


