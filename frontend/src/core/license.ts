/**
 * LICENSE MODULE - SECURE BACKEND INTEGRATION
 * --------------------------------------------
 * All license verification now happens in the Go backend.
 * This module provides a thin wrapper for frontend use.
 * 
 * SECURITY: Supabase credentials are no longer exposed in frontend code.
 */

import { api, LicenseResult } from './api';

// Re-export LicenseResult for convenience
export type { LicenseResult };

/**
 * Gets the Device ID from the backend
 * This is a hardware-based ID stored securely
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    return await api.system.getDeviceId();
  } catch (e) {
    console.error("Failed to get device ID:", e);
    return "";
  }
};

/**
 * Gets the stored license key from backend
 */
export const getStoredLicenseKey = async (): Promise<string | null> => {
  try {
    const key = await api.license.getStoredKey();
    return key || null;
  } catch (e) {
    console.error("Failed to get stored license key:", e);
    return null;
  }
};

/**
 * Activates a new license key via backend
 * The backend handles device binding and server communication
 */
export const activateLicense = async (licenseKey: string): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await api.license.activate(licenseKey);
    return {
      success: result.licensed,
      message: result.message
    };
  } catch (error) {
    console.error("Activation Error:", error);
    return {
      success: false,
      message: "تعذر الاتصال بخادم التراخيص. تأكد من الإنترنت."
    };
  }
};

/**
 * Verifies license via backend
 * The backend handles:
 * - Server verification with Supabase
 * - Device ID matching
 * - Encrypted cache for offline use
 * - Tamper detection
 */
export const verifyLicense = async (licenseKey: string): Promise<LicenseResult> => {
  try {
    const result = await api.license.verify(licenseKey);
    return result;
  } catch (error) {
    console.error("Verification Error:", error);

    // Try cached license
    try {
      const cached = await api.license.getCached();
      if (cached && cached.licensed) {
        return cached;
      }
    } catch (cacheError) {
      // Ignore cache errors
    }

    return {
      success: false,
      licensed: false,
      message: "خطأ في التحقق من الترخيص. يرجى الاتصال بالإنترنت.",
      features: {}
    };
  }
};

/**
 * Gets cached license from backend
 * Returns null if no valid cache exists
 */
export const getCachedLicense = async (): Promise<LicenseResult | null> => {
  try {
    const result = await api.license.getCached();
    return result.licensed ? result : null;
  } catch (e) {
    return null;
  }
};

// Legacy exports for compatibility (deprecated - use async versions)
// These are kept for backward compatibility but should be migrated
export const setStoredLicenseKey = (_key: string) => {
  console.warn('setStoredLicenseKey is deprecated. License key is now stored by backend.');
};

// These are no longer exposed for security
export const SUPABASE_URL = '[SECURED_IN_BACKEND]';
export const SUPABASE_ANON_KEY = '[SECURED_IN_BACKEND]';
export const FUNCTIONS_URL = '[SECURED_IN_BACKEND]';
