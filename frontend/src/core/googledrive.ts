import { api } from './api';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface DriveConfig {
    enabled: boolean;
    autoBackup: boolean;
    backupInterval: number; // hours
    lastBackup?: number;
    folderId?: string;
}

export interface BackupStatus {
    inProgress: boolean;
    connected: boolean;
    lastBackup: number | null;
    lastBackupSize: string | null;
    error: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Google Drive Manager Class
// ═══════════════════════════════════════════════════════════════════════════════

class GoogleDriveManager {
    private status: BackupStatus = {
        inProgress: false,
        connected: false,
        lastBackup: null,
        lastBackupSize: null,
        error: null
    };
    private statusListeners: Set<(status: BackupStatus) => void> = new Set();

    constructor() {
        this.checkConnection();
    }

    async checkConnection() {
        try {
            const connected = await api.drive.isConnected();
            this.updateStatus({ connected });
        } catch (e) {
            console.error('Failed to check drive connection', e);
        }
    }

    async connect(): Promise<boolean> {
        try {
            this.updateStatus({ inProgress: true, error: null });
            const url = await api.drive.initAuth();
            if (url) {
                // Open system browser
                BrowserOpenURL(url);

                // Wait for completion
                await api.drive.completeAuth();
                this.updateStatus({ connected: true, inProgress: false });
                return true;
            }
        } catch (e: unknown) {
            this.updateStatus({ inProgress: false, error: 'فشل الاتصال: ' + String(e) });
        }
        return false;
    }

    async disconnect() {
        await api.drive.disconnect();
        this.updateStatus({ connected: false });
    }

    /**
     * Create a backup JSON and Upload to Drive
     */
    async createAndUploadBackup(): Promise<{ success: boolean; error?: string }> {
        try {
            this.updateStatus({ inProgress: true, error: null });

            // 1. Generate Backup Data
            const prefsStr = localStorage.getItem('beidar_preferences');
            const prefs = prefsStr ? JSON.parse(prefsStr) : {};

            // For full backup, we really should fetch data from backend, 
            // but sticking to previous logic of "CreateBackup" which seemed to be prefs-only or full?
            // The previous logic had "handleFullBackup" which called api.db.export().
            // Let's assume we want FULL backup for Drive.

            const dbData = await api.db.export();
            const backup = {
                version: '1.0',
                createdAt: Date.now(),
                appName: 'Beidar POS',
                data: dbData,
                preferences: prefs,
            };

            const jsonData = JSON.stringify(backup, null, 2);
            const sizeKB = Math.round(jsonData.length / 1024);
            const filename = `beidar_backup_${new Date().toISOString().slice(0, 10)}.json`;

            // 2. Upload
            await api.drive.uploadBackup(filename, jsonData);

            this.updateStatus({
                inProgress: false,
                lastBackup: Date.now(),
                lastBackupSize: `${sizeKB} KB`
            });

            return { success: true };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.updateStatus({ inProgress: false, error: msg });
            return { success: false, error: msg };
        }
    }

    /**
     * Legacy Manual Backup (Download)
     */
    async downloadBackupLocal(): Promise<void> {
        try {
            const dbData = await api.db.export();
            const jsonData = JSON.stringify(dbData, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `beidar_local_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Restore from backup JSON
     */
    async restoreFromBackup(jsonData: string): Promise<{ success: boolean; error?: string }> {
        try {
            this.updateStatus({ inProgress: true, error: null });
            const backup = JSON.parse(jsonData);

            // Restore DB
            if (backup.data) {
                await api.db.import(backup.data);
            }

            // Restore preferences
            if (backup.preferences) {
                localStorage.setItem('beidar_preferences', JSON.stringify(backup.preferences));
            }

            this.updateStatus({ inProgress: false });
            return { success: true };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.updateStatus({ inProgress: false, error: msg });
            return { success: false, error: msg };
        }
    }

    /**
     * Get current status
     */
    getStatus(): BackupStatus {
        return { ...this.status };
    }

    /**
     * Subscribe to status changes
     */
    onStatusChange(callback: (status: BackupStatus) => void): () => void {
        this.statusListeners.add(callback);
        callback(this.status);
        return () => this.statusListeners.delete(callback);
    }

    private updateStatus(partial: Partial<BackupStatus>): void {
        this.status = { ...this.status, ...partial };
        this.statusListeners.forEach(cb => cb(this.status));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Export
// ═══════════════════════════════════════════════════════════════════════════════

export const googleDriveBackup = new GoogleDriveManager();

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get backup config from localStorage
 */
export const getBackupConfig = (): DriveConfig => {
    try {
        const stored = localStorage.getItem('beidar_backup_config');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to read backup config:', e);
    }

    return {
        enabled: false,
        autoBackup: false,
        backupInterval: 24 // 24 hours
    };
};

/**
 * Save backup config to localStorage
 */
export const saveBackupConfig = (config: DriveConfig): void => {
    localStorage.setItem('beidar_backup_config', JSON.stringify(config));
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Format last backup time
 */
export const formatBackupTime = (timestamp: number | null): string => {
    if (!timestamp) return 'لم يتم النسخ بعد';

    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'منذ أقل من ساعة';
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 7) return `منذ ${days} يوم`;
    return new Date(timestamp).toLocaleDateString('ar-IQ');
};
