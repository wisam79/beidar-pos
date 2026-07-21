package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// BackupHandler handles Wails database, CSV, and image store management requests
type BackupHandler struct {
	ctx           context.Context
	backupService domain.BackupService
}

// NewBackupHandler creates a new instance of BackupHandler
func NewBackupHandler(backupService domain.BackupService) *BackupHandler {
	return &BackupHandler{
		backupService: backupService,
	}
}

// Startup is called when the app starts
func (h *BackupHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

// CreateBackup creates a database backup file
func (h *BackupHandler) CreateBackup() (*domain.BackupResult, error) {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return nil, err
	}
	return h.backupService.CreateBackup()
}

// ListBackups lists all available backup files
func (h *BackupHandler) ListBackups() ([]domain.BackupInfo, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.backupService.ListBackups()
}

// RestoreBackup restores data from a backup file path
func (h *BackupHandler) RestoreBackup(backupPath string) error {
	if err := auth.RequireAdmin(); err != nil {
		return err
	}
	return h.backupService.RestoreBackup(backupPath)
}

// DeleteBackup deletes a backup file from disk
func (h *BackupHandler) DeleteBackup(backupPath string) error {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return err
	}
	return h.backupService.DeleteBackup(backupPath)
}

// CleanOldBackups deletes backups older than retainDays
func (h *BackupHandler) CleanOldBackups(retainDays int) (int, error) {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return 0, err
	}
	return h.backupService.CleanOldBackups(retainDays)
}

// ResetDatabase clears all tables and seeds default admin and preferences
func (h *BackupHandler) ResetDatabase() error {
	if err := auth.RequireAdmin(); err != nil {
		return err
	}
	return h.backupService.ResetDatabase()
}

// ExportDatabase exports the database tables directly
func (h *BackupHandler) ExportDatabase() (*domain.DatabaseExport, error) {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return nil, err
	}
	return h.backupService.ExportDatabase()
}

// ImportDatabase imports database tables directly
func (h *BackupHandler) ImportDatabase(data domain.DatabaseExport) error {
	if err := auth.RequireAdmin(); err != nil {
		return err
	}
	return h.backupService.ImportDatabase(data)
}

// ExportProductsCSV exports all products to CSV string
func (h *BackupHandler) ExportProductsCSV() (*domain.CSVExportResult, error) {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return nil, err
	}
	return h.backupService.ExportProductsCSV()
}

// ImportProductsCSV imports products from a CSV string
func (h *BackupHandler) ImportProductsCSV(csvData string, updateExisting bool) (*domain.CSVImportResult, error) {
	if err := auth.RequirePermission(auth.PermProducts); err != nil {
		return nil, err
	}
	return h.backupService.ImportProductsCSV(csvData, updateExisting)
}

// GetCSVTemplate returns a product CSV template
func (h *BackupHandler) GetCSVTemplate() string {
	return h.backupService.GetCSVTemplate()
}

// MigrateImagesToFilesystem migrates Base64 images to local filesystem files
func (h *BackupHandler) MigrateImagesToFilesystem() (int, error) {
	if err := auth.RequireAdmin(); err != nil {
		return 0, err
	}
	return h.backupService.MigrateImagesToFilesystem()
}

// GetImageStorageStats returns current image store counts and sizes
func (h *BackupHandler) GetImageStorageStats() (*domain.ImageStorageStats, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.backupService.GetImageStorageStats()
}

// ExportProductsCSVNative prompts the user with SaveFileDialog and writes the products CSV directly to disk
func (h *BackupHandler) ExportProductsCSVNative() (*domain.CSVExportResult, error) {
	res, err := h.ExportProductsCSV()
	if err != nil {
		return nil, err
	}

	savePath, err := runtime.SaveFileDialog(h.ctx, runtime.SaveDialogOptions{
		Title:           "تصدير المنتجات CSV",
		DefaultFilename: res.Filename,
		Filters: []runtime.FileFilter{
			{DisplayName: "CSV Files (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return nil, err
	}
	if savePath == "" {
		return nil, fmt.Errorf("cancelled")
	}

	err = os.WriteFile(savePath, []byte(res.Data), 0644)
	if err != nil {
		return nil, err
	}

	return res, nil
}

// DownloadProductsTemplateNative prompts the user with SaveFileDialog for products_template.csv and writes it to disk
func (h *BackupHandler) DownloadProductsTemplateNative() (bool, error) {
	if err := auth.Require(); err != nil {
		return false, err
	}
	templateStr := h.GetCSVTemplate()

	savePath, err := runtime.SaveFileDialog(h.ctx, runtime.SaveDialogOptions{
		Title:           "تحميل نموذج المنتجات CSV",
		DefaultFilename: "products_template.csv",
		Filters: []runtime.FileFilter{
			{DisplayName: "CSV Files (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return false, err
	}
	if savePath == "" {
		return false, nil
	}

	err = os.WriteFile(savePath, []byte(templateStr), 0644)
	if err != nil {
		return false, err
	}

	return true, nil
}

// ImportProductsCSVNative prompts the user with OpenFileDialog, reads the CSV, and imports it
func (h *BackupHandler) ImportProductsCSVNative(updateExisting bool) (*domain.CSVImportResult, error) {
	if err := auth.RequirePermission(auth.PermProducts); err != nil {
		return nil, err
	}
	openPath, err := runtime.OpenFileDialog(h.ctx, runtime.OpenDialogOptions{
		Title: "استيراد المنتجات CSV",
		Filters: []runtime.FileFilter{
			{DisplayName: "CSV Files (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return nil, err
	}
	if openPath == "" {
		return nil, fmt.Errorf("cancelled")
	}

	csvData, err := os.ReadFile(openPath)
	if err != nil {
		return nil, err
	}

	return h.ImportProductsCSV(string(csvData), updateExisting)
}

// ExportDatabaseBackupNative prompts the user with SaveFileDialog and exports a database backup JSON to disk
func (h *BackupHandler) ExportDatabaseBackupNative() (bool, error) {
	data, err := h.ExportDatabase()
	if err != nil {
		return false, err
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return false, fmt.Errorf("failed to marshal backup data: %w", err)
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	defaultFilename := fmt.Sprintf("beidar_backup_%s.json", timestamp)

	savePath, err := runtime.SaveFileDialog(h.ctx, runtime.SaveDialogOptions{
		Title:           "تصدير نسخة احتياطية لقاعدة البيانات",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return false, err
	}
	if savePath == "" {
		return false, nil
	}

	if err := os.WriteFile(savePath, jsonData, 0644); err != nil {
		return false, fmt.Errorf("failed to write backup file: %w", err)
	}

	return true, nil
}

// ImportDatabaseBackupNative prompts the user with OpenFileDialog, reads JSON backup, and restores database
func (h *BackupHandler) ImportDatabaseBackupNative() (bool, error) {
	if err := auth.RequireAdmin(); err != nil {
		return false, err
	}
	openPath, err := runtime.OpenFileDialog(h.ctx, runtime.OpenDialogOptions{
		Title: "استيراد نسخة احتياطية لقاعدة البيانات",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
		},
	})
	if err != nil {
		return false, err
	}
	if openPath == "" {
		return false, nil
	}

	jsonData, err := os.ReadFile(openPath)
	if err != nil {
		return false, fmt.Errorf("failed to read backup file: %w", err)
	}

	var data domain.DatabaseExport
	if err := json.Unmarshal(jsonData, &data); err != nil {
		return false, fmt.Errorf("failed to parse backup file: %w", err)
	}

	if err := h.ImportDatabase(data); err != nil {
		return false, fmt.Errorf("failed to restore backup: %w", err)
	}

	return true, nil
}
