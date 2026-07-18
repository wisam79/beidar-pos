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

	"github.com/google/uuid"
)

type backupService struct {
	backupRepo  domain.BackupRepository
	productRepo domain.ProductRepository
}

// NewBackupService creates a new instance of domain.BackupService
func NewBackupService(backupRepo domain.BackupRepository, productRepo domain.ProductRepository) domain.BackupService {
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

	info, err := os.Stat(backupPath)

	result.Success = true
	result.Path = backupPath
	if err == nil {
		result.Size = info.Size()
	}
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

func validateBackupPath(backupPath string) (string, error) {
	backupDir, err := GetBackupDir()
	if err != nil {
		return "", fmt.Errorf("failed to get backup directory: %w", err)
	}

	absBackupDir, err := filepath.Abs(backupDir)
	if err != nil {
		return "", fmt.Errorf("failed to resolve absolute backup directory: %w", err)
	}

	absBackupPath, err := filepath.Abs(backupPath)
	if err != nil {
		return "", fmt.Errorf("invalid path format: %w", err)
	}

	rel, err := filepath.Rel(absBackupDir, absBackupPath)
	if err != nil || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", fmt.Errorf("access denied: path traversal attempt detected")
	}

	return absBackupPath, nil
}

func (s *backupService) RestoreBackup(backupPath string) error {
	validatedPath, err := validateBackupPath(backupPath)
	if err != nil {
		return err
	}

	data, err := os.ReadFile(validatedPath)
	if err != nil {
		return fmt.Errorf("فشل قراءة ملف النسخة: %w", err)
	}

	var dbExport domain.DatabaseExport
	if err := json.Unmarshal(data, &dbExport); err != nil {
		return fmt.Errorf("فشل تحليل البيانات: %w", err)
	}

	if err := s.backupRepo.Import(dbExport); err != nil {
		return fmt.Errorf("فشل استيراد البيانات: %w", err)
	}

	return nil
}

func (s *backupService) DeleteBackup(backupPath string) error {
	validatedPath, err := validateBackupPath(backupPath)
	if err != nil {
		return err
	}
	return os.Remove(validatedPath)
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

	if len(records) < 1 {
		result.Success = false
		result.Errors = append(result.Errors, "الملف فارغ أو لا يحتوي على بيانات")
		return result, nil
	}

	// Map headers (supports both Arabic and English)
	headerMap := map[string]string{
		"الباركود":        "barcode",
		"barcode":         "barcode",
		"اسم المنتج":      "name",
		"name":            "name",
		"الوصف":          "description",
		"description":     "description",
		"الفئة":           "category",
		"category":        "category",
		"المورد":          "supplier",
		"supplier":        "supplier",
		"التكلفة":         "cost",
		"cost":            "cost",
		"السعر":           "price",
		"price":           "price",
		"المخزون":         "stock",
		"stock":           "stock",
		"الحد الأدنى":     "minstock",
		"minstock":        "minstock",
		"سعر الجملة":      "wholesaleprice",
		"wholesaleprice":   "wholesaleprice",
	}

	firstRow := records[0]
	colIndices := make(map[string]int)
	isHeader := false

	for i, col := range firstRow {
		cleanCol := strings.ToLower(strings.TrimSpace(col))
		if key, ok := headerMap[cleanCol]; ok {
			colIndices[key] = i
			isHeader = true
		} else {
			colIndices[cleanCol] = i
		}
	}

	var dataRows [][]string
	if isHeader {
		if len(records) < 2 {
			result.Success = false
			result.Errors = append(result.Errors, "الملف لا يحتوي على صفوف بيانات")
			return result, nil
		}
		dataRows = records[1:]
	} else {
		// No header detected. Fallback to fixed positions and treat the first row as data.
		colIndices = map[string]int{
			"barcode":     0,
			"name":        1,
			"description": 2,
			"category":    3,
			"supplier":    4,
			"cost":        5,
			"price":       6,
			"stock":       7,
			"minstock":    8,
		}
		dataRows = records
	}

	result.TotalRows = len(dataRows)

	// Build a lookup map of existing products by barcode to avoid N+2 database lookups
	barcodeIndex := make(map[string]*domain.Product)
	allProducts, err := s.productRepo.GetAll()
	if err == nil {
		for i := range allProducts {
			if allProducts[i].Barcode != "" {
				barcodeIndex[allProducts[i].Barcode] = &allProducts[i]
			}
		}
	}

	if txErr := s.productRepo.Transaction(func(tx domain.Tx) error {
		txRepo := s.productRepo.WithTx(tx)

		for i, record := range dataRows {
			rowNum := i + 1
			if isHeader {
				rowNum++
			}

			getVal := func(key string) string {
				if idx, ok := colIndices[key]; ok && idx < len(record) {
					return strings.TrimSpace(record[idx])
				}
				return ""
			}

			name := getVal("name")
			barcode := getVal("barcode")
			priceStr := getVal("price")
			costStr := getVal("cost")
			stockStr := getVal("stock")
			minStockStr := getVal("minstock")
			category := getVal("category")
			supplier := getVal("supplier")
			description := getVal("description")
			wholesalePriceStr := getVal("wholesaleprice")

			if name == "" {
				result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: اسم المنتج مطلوب", rowNum))
				result.Skipped++
				continue
			}

			priceVal, err := parseFloat(priceStr)
			if err != nil || priceVal <= 0 {
				result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: السعر غير صالح (يجب أن يكون أكبر من صفر)", rowNum))
				result.Skipped++
				continue
			}

			costVal, _ := parseFloat(costStr)
			stockVal, _ := parseFloat(stockStr)
			minStockVal, _ := parseFloat(minStockStr)
			wholesalePriceVal, _ := parseFloat(wholesalePriceStr)

			price := domain.NewAmount(priceVal)
			cost := domain.NewAmount(costVal)
			wholesalePrice := domain.NewAmount(wholesalePriceVal)

			var existingProduct *domain.Product
			found := false

			if barcode != "" {
				if p, ok := barcodeIndex[barcode]; ok {
					existingProduct = p
					found = true
				}
			}

			if found && updateExisting {
				existingProduct.Name = name
				existingProduct.Description = description
				existingProduct.Category = category
				existingProduct.Supplier = supplier
				existingProduct.Cost = cost
				existingProduct.Price = price
				existingProduct.Stock = stockVal
				existingProduct.MinStock = minStockVal
				existingProduct.WholesalePrice = wholesalePrice

				if err := txRepo.Update(existingProduct); err != nil {
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
				prodID := "prod_" + uuid.New().String()
				newProduct := domain.Product{
					ID:             prodID,
					Barcode:        barcode,
					Name:           name,
					Description:    description,
					Category:       category,
					Supplier:       supplier,
					Cost:           cost,
					Price:          price,
					Stock:          stockVal,
					MinStock:       minStockVal,
					WholesalePrice: wholesalePrice,
				}

				if err := txRepo.Create(&newProduct); err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("سطر %d: فشل الإنشاء - %v", rowNum, err))
					result.Skipped++
					continue
				}
				result.Imported++
				result.ImportedIDs = append(result.ImportedIDs, newProduct.ID)
			}
		}
		return nil
	}); txErr != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("فشل عملية الاستيراد: %v", txErr))
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
	err = s.productRepo.Transaction(func(tx domain.Tx) error {
		txRepo := s.productRepo.WithTx(tx)
		for _, p := range products {
			filename, err := imagestore.SaveImageFromBase64(p.Image, p.ID)
			if err != nil {
				fmt.Printf("⚠️ Failed to migrate image for product %s: %v\n", p.ID, err)
				continue
			}

			if filename != "" && filename != p.Image {
				p.Image = filename
				if err := txRepo.Update(&p); err != nil {
					return fmt.Errorf("failed to update product %s in DB: %w", p.ID, err)
				}
				migrated++
			}
		}
		return nil
	})
	if err != nil {
		return migrated, err
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


