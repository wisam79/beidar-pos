/// <reference types="vite/client" />

declare module 'qrcode' {
    export function toString(text: string, options?: Record<string, unknown>): Promise<string>;
    export function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Window extension for Wails runtime and App-bound methods
interface Window {
    requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    webkitAudioContext: typeof AudioContext;
    go: {
        main: {
            App: {
                ImportProductsCSV(text: string, updateExisting: boolean): Promise<ImportResult>;
                ExportProductsCSV(): Promise<ExportResult>;
                GetCSVTemplate(): Promise<string>;
                AI_GenerateStream(prompt: string): Promise<void>;
                CalculateInstallmentPlan(total: number, downPayment: number, months: number): Promise<InstallmentPlan>;
                GetLicenseUserDetails(deviceId: string): Promise<UserDetailsData>;
                GetBackupConfig(): Promise<{ cloudAutoSync: boolean }>;
                SetCloudAutoSync(enabled: boolean): Promise<void>;
                ExportProductsCSVNative(): Promise<ExportResult>;
                DownloadProductsTemplateNative(): Promise<boolean>;
                ImportProductsCSVNative(updateExisting: boolean): Promise<ImportResult>;
                ExportDatabaseBackupNative(): Promise<boolean>;
                ImportDatabaseBackupNative(): Promise<boolean>;
            }
        }
    };
    runtime: {
        EventsOn: (event: string, callback: (data: unknown) => void) => void;
        EventsOff: (event: string) => void;
    };
}

interface ImportResult {
    success: boolean;
    totalRows: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
    importedIds: string[];
}

interface ExportResult {
    data: string;
    filename: string;
    count: number;
}

interface InstallmentPlan {
    totalAmount: number;
    downPayment: number;
    months: number;
    startDate: string;
    schedule: Installment[];
    convertValues?: unknown;
}

interface Installment {
    number: number;
    dueDate: string;
    amount: number;
    status: string;
    paidAt?: number;
}

interface UserDetailsData {
    user_id: string;
    email: string;
    store_name: string;
    created_at: string;
    last_sign_in: string;
    backups: { id: string; backup_id: string; store_name: string; size: number; created_at: string }[];
    sessions: { device_name: string; login_time: string; last_seen: string }[];
}

interface AppError {
    message: string;
    hint?: string;
    options?: {
        allowForce?: boolean;
    };
}
