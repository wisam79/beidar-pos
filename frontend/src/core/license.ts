/**
 * LICENSE MODULE - SECURE BACKEND INTEGRATION
 * --------------------------------------------
 * All license verification now happens in the Go backend.
 * This module provides a thin wrapper for frontend use.
 * 
 * SECURITY: Supabase credentials are no longer exposed in frontend code.
 */

import { api } from './api';

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