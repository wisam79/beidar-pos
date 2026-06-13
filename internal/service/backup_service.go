package service

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/imagestore"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// BackupService coordinates backups, CSV operations, and image migration
type BackupService interface {
	CreateBackup() (*domain.BackupResult, error)
	ListBackups() ([]domain.BackupInfo, error)
	RestoreBackup(backupPath string) error
	DeleteBackup(backupPath string) error
	CleanOldBackups(retainDays int) (int, error)
	ResetDatabase() error
	ExportDatabase() (*domain.DatabaseExport, error)
	ImportDatabase(data domain.DatabaseExport) error

	// CSV operations
	ExportProductsCSV() (*domain.CSVExportResult, error)
	ImportProductsCSV(csvData string, updateExisting bool) (*domain.CSVImportResult, error)
	GetCSVTemplate() string

	// Image utilities
	MigrateImagesToFilesystem() (int, error)
	GetImageStorageStats() (*domain.ImageStorageStats, error)
}

type backupService struct {
	backupRepo  domain.BackupRepository
	productRepo domain.ProductRepository
}

// NewBackupService creates a new instance of BackupService
func NewBackupService(backupRepo domain.BackupRepository, productRepo domain.ProductRepository) BackupService {
	return &backupService{
		backupRepo:  backupRepo,
		productRepo: productRepo,
	}
}

// GetBackupDir returns the backup directory path
func GetBackupDir() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	backupDir := filepath.Join(configDir, "BeidarPOS_V3", "backups")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", err
	}
	return backupDir, nil
}

func (s *backupService) CreateBackup() (*domain.BackupResult, error) {
	start := time.Now()
	result := &domain.BackupResult{Success: false}

	backupDir, err := GetBackupDir()
	if err != nil {
		result.Error = fmt.Sprintf("فشل إنشاء مجلد النسخ: %v", err)
		return result, nil
	}

	data, err := s.backupRepo.Export()
	if err != nil {
		result.Error = fmt.Sprintf("فشل تصدير البيانات: %v", err)
		return result, nil
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		result.Error = fmt.Sprintf("فشل تحويل البيانات: %v", err)
		return result, nil
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := fmt.Sprintf("beidar_backup_%s.json", timestamp)
	backupPath := filepath.Join(backupDir, filename)

	if err := os.WriteFile(backupPath, jsonData, 0644); err != nil {
		result.Error = fmt.Sprintf("فشل حفظ الملف: %v", err)
		return result, nil
	}

	info, _ := os.Stat(backupPath)

	result.Success = true
	result.Path = backupPath
	result.Size = info.Size()
	result.Duration = time.Since(start).Milliseconds()

	return result, nil
}

func (s *backupService) ListBackups() ([]domain.BackupInfo, error) {
	backupDir, err := GetBackupDir()
	if err != nil {
		return nil, err
	}

	files, err := os.ReadDir(backupDir)
	if err != nil {
		return nil, err
	}

	var backups []domain.BackupInfo
	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		info, err := file.Info()
		if err != nil {
			continue
		}

		backups = append(backups, domain.BackupInfo{
			Filename:  file.Name(),
			Path:      filepath.Join(backupDir, file.Name()),
			Size:      info.Size(),
			CreatedAt: info.ModTime().Format(time.RFC3339),
		})
	}

	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt > backups[j].CreatedAt
	})

	return backups, nil
}

func (s *backupService) RestoreBackup(backupPath string) error {
	data, err := os.ReadFile(backupPath)
	if err != nil {
		return fmt.Errorf("فشل قراءة ملف النسخة: %v", err)
	}

	var dbExport domain.DatabaseExport
	if err := json.Unmarshal(data, &dbExport); err != nil {
		return fmt.Errorf("فشل تحليل البيانات: %v", err)
	}

	if err := s.backupRepo.Import(dbExport); err != nil {
		return fmt.Errorf("فشل استيراد البيانات: %v", err)
	}

	return nil
}

func (s *backupService) DeleteBackup(backupPath string) error {
	return os.Remove(backupPath)
}

func (s *backupService) CleanOldBackups(retainDays int) (int, error) {
	if retainDays <= 0 {
		retainDays = 30
	}

	backups, err := s.ListBackups()
	if err != nil {
		return 0, err
	}

	cutoff := time.Now().AddDate(0, 0, -retainDays)
	deleted := 0

	for _, backup := range backups {
		backupTime, err := time.Parse(time.RFC3339, backup.CreatedAt)
		if err != nil {
			continue
		}

		if backupTime.Before(cutoff) {
			if err := s.DeleteBackup(backup.Path); err == nil {
				deleted++
			}
		}
	}

	return deleted, nil
}

func (s *backupService) ResetDatabase() error {
	return s.backupRepo.Reset()
}

func (s *backupService) ExportDatabase() (*domain.DatabaseExport, error) {
	return s.backupRepo.Export()
}

func (s *backupService) ImportDatabase(data domain.DatabaseExport) error {
	return s.backupRepo.Import(data)
}

// ExportProductsCSV exports all products to CSV format
func (s *backupService) ExportProductsCSV() (*domain.CSVExportResult, error) {
	products, err := s.productRepo.GetAll()
	if err != nil {
		return nil, err
	}

	headers := []string{
		"الباركود",
		"اسم المنتج",
		"الوصف",
		"الفئة",
		"المورد",
		"التكلفة",
		"السعر",
		"المخزون",
		"الحد الأدنى",
	}

	var sb strings.Builder
	writer := csv.NewWriter(&sb)

	if err := writer.Write(headers); err != nil {
		return nil, err
	}

	for _, p := range products {
		row := []string{
			p.Barcode,
			p.Name,
			p.Description,
			p.Category,
			p.Supplier,
			fmt.Sprintf("%.2f", p.Cost.Float()),
			fmt.Sprintf("%.2f", p.Price.Float()),
			fmt.Sprintf("%.2f", p.Stock),
			fmt.Sprintf("%.2f", p.MinStock),
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	writer.Flush()
	filename := fmt.Sprintf("products_%s.csv", time.Now().Format("2006-01-02"))

	return &domain.CSVExportResult{
		Data:     sb.String(),
		Filename: filename,
		Count:    len(products),
	}, nil
}

// ImportProductsCSV imports products from CSV data
func (s *backupService) ImportProductsCSV(csvData string, updateExisting bool) (*domain.CSVImportResult, error) {
	result := &domain.CSVImportResult{
		Success:     true,
		Errors:      []string{},
		ImportedIDs: []string{},
	}

	reader := csv.NewReader(strings.NewReader(csvData))
	records, err := reader.ReadAll()
	if err != nil {
		result.Success = false
		result.Errors = append(result.Errors, fmt.Sprintf("فشل قراءة CSV: %v", err))
		return result, nil
	}

	if len(records) < 2 {
		result.Success = false
		result.Errors = append(result.Errors, "الملف فارغ أو لا يحتوي على بيانات")
		return result, nil
	}

	result.TotalRows = len(records) - 1

	for i, record := range records[1:] {
		rowNum := i + 2

		if len(record) < 7 {
			result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: عدد الأعمدة غير صحيح", rowNum))
			result.Skipped++
			continue
		}

		barcode := strings.TrimSpace(record[0])
		name := strings.TrimSpace(record[1])
		description := strings.TrimSpace(record[2])
		category := strings.TrimSpace(record[3])
		supplier := strings.TrimSpace(record[4])

		cost, err := parseFloat(record[5])
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: التكلفة غير صالحة", rowNum))
			result.Skipped++
			continue
		}

		price, err := parseFloat(record[6])
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: السعر غير صالح", rowNum))
			result.Skipped++
			continue
		}

		var stock float64 = 0
		if len(record) > 7 {
			stock, _ = parseFloat(record[7])
		}

		var minStock float64 = 5
		if len(record) > 8 {
			minStock, _ = parseFloat(record[8])
		}

		if name == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: اسم المنتج مطلوب", rowNum))
			result.Skipped++
			continue
		}

		if price <= 0 {
			result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: السعر يجب أن يكون أكبر من صفر", rowNum))
			result.Skipped++
			continue
		}

		var existingProduct *domain.Product
		found := false

		if barcode != "" {
			if p, err := s.productRepo.GetByBarcode(barcode); err == nil && p != nil {
				existingProduct = p
				found = true
			}
		}

		if found && updateExisting {
			existingProduct.Name = name
			existingProduct.Description = description
			existingProduct.Category = category
			existingProduct.Supplier = supplier
			existingProduct.Cost = domain.NewAmount(cost)
			existingProduct.Price = domain.NewAmount(price)
			existingProduct.Stock = stock
			existingProduct.MinStock = minStock

			if err := s.productRepo.Update(existingProduct); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: فشل التحديث - %v", rowNum, err))
				result.Skipped++
				continue
			}
			result.Updated++
			result.ImportedIDs = append(result.ImportedIDs, existingProduct.ID)
		} else if found && !updateExisting {
			result.Skipped++
			continue
		} else {
			newProduct := domain.Product{
				ID:          generateID(),
				Barcode:     barcode,
				Name:        name,
				Description: description,
				Category:    category,
				Supplier:    supplier,
				Cost:        domain.NewAmount(cost),
				Price:       domain.NewAmount(price),
				Stock:       stock,
				MinStock:    minStock,
			}

			if err := s.productRepo.Create(&newProduct); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: فشل الإنشاء - %v", rowNum, err))
				result.Skipped++
				continue
			}
			result.Imported++
			result.ImportedIDs = append(result.ImportedIDs, newProduct.ID)
		}
	}

	result.Success = len(result.Errors) == 0 || (result.Imported+result.Updated) > 0
	return result, nil
}

// GetCSVTemplate returns a sample CSV template
func (s *backupService) GetCSVTemplate() string {
	headers := []string{
		"الباركود",
		"اسم المنتج",
		"الوصف",
		"الفئة",
		"المورد",
		"التكلفة",
		"السعر",
		"المخزون",
		"الحد الأدنى",
	}

	exampleRow := []string{
		"123456789",
		"منتج مثال",
		"وصف المنتج",
		"إلكترونيات",
		"مورد 1",
		"5000",
		"7500",
		"100",
		"10",
	}

	var sb strings.Builder
	writer := csv.NewWriter(&sb)
	_ = writer.Write(headers)
	_ = writer.Write(exampleRow)
	writer.Flush()

	return sb.String()
}

func (s *backupService) MigrateImagesToFilesystem() (int, error) {
	products, err := s.productRepo.GetProductsWithBase64Images()
	if err != nil {
		return 0, err
	}

	if len(products) == 0 {
		return 0, nil
	}

	fmt.Printf("🔄 Migrating %d product images to filesystem...\n", len(products))

	migrated := 0
	for _, p := range products {
		filename, err := imagestore.SaveImageFromBase64(p.Image, p.ID)
		if err != nil {
			fmt.Printf("⚠️ Failed to migrate image for product %s: %v\n", p.ID, err)
			continue
		}

		if filename != "" && filename != p.Image {
			p.Image = filename
			if err := s.productRepo.Update(&p); err != nil {
				fmt.Printf("⚠️ Failed to update product %s in DB: %v\n", p.ID, err)
				continue
			}
			migrated++
		}
	}

	if migrated > 0 {
		_ = s.productRepo.Vacuum()
	}

	return migrated, nil
}

func (s *backupService) GetImageStorageStats() (*domain.ImageStorageStats, error) {
	stats := &domain.ImageStorageStats{}

	totalImages, totalSizeBytes, err := imagestore.GetDirectoryStats()
	if err != nil {
		return stats, err
	}

	stats.TotalImages = totalImages
	stats.TotalSizeBytes = totalSizeBytes
	stats.TotalSizeMB = float64(totalSizeBytes) / (1024 * 1024)

	base64Count, err := s.productRepo.CountProductsWithBase64Images()
	if err == nil {
		stats.Base64Count = int(base64Count)
	}

	return stats, nil
}

// Helpers
func parseFloat(s string) (float64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	if s == "" {
		return 0, nil
	}
	return strconv.ParseFloat(s, 64)
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
