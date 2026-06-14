-- =========================================================================
-- BEIDAR ADMIN SECURITY SETUP
-- =========================================================================
-- This script sets up Row Level Security (RLS) on the licenses and admin_logs
-- tables so they can be securely managed from a standalone admin portal
-- without exposing the master service_role_key.
-- =========================================================================

-- 1. Create the app_admins table to track authorized administrator accounts
CREATE TABLE IF NOT EXISTS public.app_admins (
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
