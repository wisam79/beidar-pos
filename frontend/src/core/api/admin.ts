import * as SettingsHandler from '../../../wailsjs/go/handlers/SettingsHandler';
import * as StaffHandler from '../../../wailsjs/go/handlers/StaffHandler';
import * as CloudHandler from '../../../wailsjs/go/handlers/CloudHandler';
import { AppPreferences, Staff } from './types';

export const prefs = {
    get: () => SettingsHandler.GetPreferences(),
    set: (p: AppPreferences) => SettingsHandler.UpdatePreferences(p),
};

export const auth = {
    verifyPin: (pin: string) => SettingsHandler.VerifyAdminPin(pin),
};

export const staff = {
    list: () => StaffHandler.GetAllStaff(),
    listActive: () => StaffHandler.GetActiveStaff(),
    get: (id: string) => StaffHandler.GetStaff(id),
    create: (s: Staff, password: string) => StaffHandler.CreateStaff(s, password),
    update: (s: Staff) => StaffHandler.UpdateStaff(s),
    updatePassword: (id: string, newPassword: string) => StaffHandler.UpdateStaffPassword(id, newPassword),
    updatePIN: (id: string, pin: string) => StaffHandler.UpdateStaffPIN(id, pin),
    delete: (id: string, force?: boolean) => StaffHandler.DeleteStaff(id, force || false),
    toggle: (id: string) => StaffHandler.ToggleStaffStatus(id),
    loginUsername: (username: string, password: string) => StaffHandler.AuthenticateByUsername(username, password),
    loginPIN: (pin: string) => StaffHandler.AuthenticateByPIN(pin),
    authenticate: (username: string, password: string) => StaffHandler.AuthenticateByUsername(username, password),
    authenticateByPIN: (pin: string) => StaffHandler.AuthenticateByPIN(pin),
    hasPermission: (staffId: string, permission: string) => StaffHandler.HasPermission(staffId, permission),
    count: () => StaffHandler.GetStaffCount(),
    isUsingDefaultPassword: (staffId: string) => StaffHandler.IsUsingDefaultPassword(staffId),
};

export const license = {
    verify: (key: string) => CloudHandler.VerifyLicense(key),
    activate: (key: string) => CloudHandler.ActivateLicense(key),
    getCached: () => CloudHandler.GetCachedLicense(),
    getStoredKey: () => CloudHandler.GetStoredLicenseKey(),
    getUserLicenseStatus: () => CloudHandler.GetUserLicenseStatus(),
    checkStatus: (key: string) => CloudHandler.CheckLicenseStatus(key),
};

export const admin = {
    setMasterKey: (key: string) => CloudHandler.SetMasterKey(key),
    login: (username: string, password: string) => CloudHandler.AdminLogin(username, password),
    fetchLicenses: () => CloudHandler.FetchAllLicenses(),
    createLicense: (name: string, phone: string, months: number, features: Record<string, boolean>) =>
        CloudHandler.CreateLicense(name, phone, months, features),
    updateStatus: (id: number, status: string) => CloudHandler.UpdateLicenseStatus(id, status),
    extendLicense: (id: number, expiry: string, months: number) => CloudHandler.ExtendLicense(id, expiry, months),
    resetToTrial: (id: number) => CloudHandler.ResetLicenseToTrial(id),
    updatePaymentStatus: (id: number, isPaid: boolean) => CloudHandler.UpdatePaymentStatus(id, isPaid),
    updateFeatures: (id: number, features: Record<string, boolean>) => CloudHandler.UpdateLicenseFeatures(id, features),
    deleteLicense: (id: number) => CloudHandler.DeleteLicenseRemote(id),
    fetchLogs: () => CloudHandler.FetchAdminLogs(),
    logAction: (user: string, action: string, target: string, details: string) =>
        CloudHandler.LogAdminAction(user, action, target, details),
    getUserDetails: (userId: string) => CloudHandler.GetLicenseUserDetails(userId),
};

export const cloud = {
    register: (email: string, password: string, storeName: string) =>
        CloudHandler.Register(email, password, storeName),
    login: (email: string, password: string) =>
        CloudHandler.Login(email, password),
    recoverPassword: (email: string) => CloudHandler.RecoverPassword(email),
    logout: () => CloudHandler.Logout(),
    isLoggedIn: () => CloudHandler.IsLoggedIn(),
    getCurrentUser: () => CloudHandler.GetCurrentUser(),
    checkSession: () => CloudHandler.CheckSessionValidity(),
    deleteAccount: () => CloudHandler.DeleteCurrentUser(),
    backupNow: () => CloudHandler.CloudBackupNow(),
    listBackups: () => CloudHandler.ListCloudBackupsForUser(),
    deleteBackup: (id: string) => CloudHandler.DeleteCloudBackup(id),
    restoreBackup: (id: string) => CloudHandler.RestoreCloudBackup(id),
};

export const system = {
    greet: (name: string) => Promise.resolve("Hello " + name),
    getDeviceId: () => SettingsHandler.GetDeviceID(),
    showMessage: (title: string, message: string) => SettingsHandler.ShowNativeNotification(title, message, "info"),
};

export const ai = {
    setKey: (key: string) => SettingsHandler.SaveGlobalAIKeys([key], ""),
    generateBasic: (prompt: string) => Promise.resolve(''),
    generateComplex: (prompt: string) => Promise.resolve(''),
    fetchGlobalKeys: () => SettingsHandler.FetchGlobalAIKeys(),
    saveGlobalKeys: (keys: string[]) => SettingsHandler.SaveGlobalAIKeys(keys, ""),
    listModels: () => Promise.resolve([]),
    fetchUsageStats: () => Promise.resolve([]),
    generateStream: (prompt: string) => Promise.resolve(),
};
