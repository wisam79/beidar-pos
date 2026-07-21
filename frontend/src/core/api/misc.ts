import * as BackupHandler from '../../../wailsjs/go/handlers/BackupHandler';
import * as App from '../../../wailsjs/go/main/App';
import * as Models from '../../../wailsjs/go/models';

export const db = {
    reset: () => BackupHandler.ResetDatabase(),
    export: () => BackupHandler.ExportDatabase(),
    import: (data: Models.domain.DatabaseExport) => BackupHandler.ImportDatabase(data),
    createBackup: () => BackupHandler.CreateBackup(),
};

export const backup = {
    createBackup: () => BackupHandler.CreateBackup(),
    listBackups: () => BackupHandler.ListBackups(),
    restoreBackup: (backupPath: string) => BackupHandler.RestoreBackup(backupPath),
    deleteBackup: (backupPath: string) => BackupHandler.DeleteBackup(backupPath),
    cleanOldBackups: (retainDays: number) => BackupHandler.CleanOldBackups(retainDays),
};

export const ImportProductsCSVNative = (updateExisting: boolean) => BackupHandler.ImportProductsCSVNative(updateExisting);
export const ExportProductsCSVNative = () => BackupHandler.ExportProductsCSVNative();
export const DownloadProductsTemplateNative = () => BackupHandler.DownloadProductsTemplateNative();
export const ExportDatabaseBackupNative = () => BackupHandler.ExportDatabaseBackupNative();
export const ImportDatabaseBackupNative = () => BackupHandler.ImportDatabaseBackupNative();
