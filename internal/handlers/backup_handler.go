package handlers

import (
	"beidar-desktop/internal/core/domain"
	"context"
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
	return h.backupService.CreateBackup()
}

// ListBackups lists all available backup files
func (h *BackupHandler) ListBackups() ([]domain.BackupInfo, error) {
	return h.backupService.ListBackups()
}

// RestoreBackup restores data from a backup file path
func (h *BackupHandler) RestoreBackup(backupPath string) error {
	return h.backupService.RestoreBackup(backupPath)
}

// DeleteBackup deletes a backup file from disk
func (h *BackupHandler) DeleteBackup(backupPath string) error {
	return h.backupService.DeleteBackup(backupPath)
}

// CleanOldBackups deletes backups older than retainDays
func (h *BackupHandler) CleanOldBackups(retainDays int) (int, error) {
	return h.backupService.CleanOldBackups(retainDays)
}

// ResetDatabase clears all tables and seeds default admin and preferences
func (h *BackupHandler) ResetDatabase() error {
	return h.backupService.ResetDatabase()
}

// ExportDatabase exports the database tables directly
func (h *BackupHandler) ExportDatabase() (*domain.DatabaseExport, error) {
	return h.backupService.ExportDatabase()
}

// ImportDatabase imports database tables directly
func (h *BackupHandler) ImportDatabase(data domain.DatabaseExport) error {
	return h.backupService.ImportDatabase(data)
}

// ExportProductsCSV exports all products to CSV string
func (h *BackupHandler) ExportProductsCSV() (*domain.CSVExportResult, error) {
	return h.backupService.ExportProductsCSV()
}

// ImportProductsCSV imports products from a CSV string
func (h *BackupHandler) ImportProductsCSV(csvData string, updateExisting bool) (*domain.CSVImportResult, error) {
	return h.backupService.ImportProductsCSV(csvData, updateExisting)
}

// GetCSVTemplate returns a product CSV template
func (h *BackupHandler) GetCSVTemplate() string {
	return h.backupService.GetCSVTemplate()
}

// MigrateImagesToFilesystem migrates Base64 images to local filesystem files
func (h *BackupHandler) MigrateImagesToFilesystem() (int, error) {
	return h.backupService.MigrateImagesToFilesystem()
}

// GetImageStorageStats returns current image store counts and sizes
func (h *BackupHandler) GetImageStorageStats() (*domain.ImageStorageStats, error) {
	return h.backupService.GetImageStorageStats()
}
