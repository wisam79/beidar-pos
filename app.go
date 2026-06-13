package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/handlers"
	"beidar-desktop/internal/integration"
	"beidar-desktop/internal/network"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/pkg/imagestore"
	"beidar-desktop/pkg/updater"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx             context.Context
	ProductHandler  *handlers.ProductHandler
	SaleHandler     *handlers.SaleHandler
	PaymentHandler  *handlers.PaymentHandler
	FinanceHandler  *handlers.FinanceHandler
	CRMHandler      *handlers.CRMHandler
	StaffHandler    *handlers.StaffHandler
	StatsHandler    *handlers.StatsHandler
	PrintHandler    *handlers.PrintHandler
	BackupHandler   *handlers.BackupHandler
	SettingsHandler *handlers.SettingsHandler
	LanHandler      *handlers.LanHandler
	CloudHandler    *handlers.CloudHandler
	DiscountHandler *handlers.DiscountHandler
}

// NewApp creates a new App application struct
func NewApp() *App {
	// 1. Initialize Database
	err := repository.InitDB()
	if err != nil {
		panic("فشل في تهيئة قاعدة البيانات: " + err.Error())
	}

	// 2. Initialize Repositories
	preferencesRepo := repository.NewPreferencesRepository(repository.DB)
	customerRepo := repository.NewCustomerRepository(repository.DB)
	productRepo := repository.NewProductRepository(repository.DB)
	shiftRepo := repository.NewShiftRepository(repository.DB)
	saleRepo := repository.NewSaleRepository(repository.DB)
	paymentRepo := repository.NewPaymentRepository(repository.DB)
	expenseRepo := repository.NewExpenseRepository(repository.DB)
	purchaseRepo := repository.NewPurchaseOrderRepository(repository.DB)
	supplierRepo := repository.NewSupplierRepository(repository.DB)
	staffRepo := repository.NewStaffRepository(repository.DB)
	statsRepo := repository.NewStatsRepository(repository.DB)
	backupRepo := repository.NewBackupRepository(repository.DB)
	networkRepo := repository.NewNetworkRepository(repository.DB)
	discountRepo := repository.NewDiscountRepository(repository.DB)

	// 3. Initialize Services
	productService := service.NewProductService(productRepo)
	saleService := service.NewSaleService(
		saleRepo,
		productRepo,
		customerRepo,
		paymentRepo,
		shiftRepo,
		preferencesRepo,
		productService,
	)
	paymentService := service.NewPaymentService(
		paymentRepo,
		customerRepo,
		saleRepo,
		shiftRepo,
		preferencesRepo,
	)
	financeService := service.NewFinanceService(
		expenseRepo,
		shiftRepo,
		purchaseRepo,
		supplierRepo,
		productRepo,
		preferencesRepo,
		productService,
	)
	crmService := service.NewCRMService(
		customerRepo,
		supplierRepo,
		productRepo,
	)
	staffService := service.NewStaffService(
		staffRepo,
	)
	statsService := service.NewStatsService(
		statsRepo,
	)
	printService := service.NewPrintService(
		saleRepo,
		preferencesRepo,
	)
	backupService := service.NewBackupService(
		backupRepo,
		productRepo,
	)
	settingsService := service.NewSettingsService(
		preferencesRepo,
	)
	discountService := service.NewDiscountService(
		discountRepo,
	)
	lanService := network.NewLanService(
		networkRepo,
		productService,
		saleService,
		crmService,
		financeService,
		statsService,
		settingsService,
		backupService,
	)

	// Seed default admin if no staff exists
	if err := staffService.SeedDefaultAdmin(); err != nil {
		panic("فشل في تهيئة المسؤول الافتراضي: " + err.Error())
	}

	// Initialize Cloud & Integrations
	cloudService := integration.NewCloudService(preferencesRepo, saleRepo, staffRepo)

	// 4. Initialize Handlers
	productHandler := handlers.NewProductHandler(productService, lanService)
	saleHandler := handlers.NewSaleHandler(saleService, lanService)
	paymentHandler := handlers.NewPaymentHandler(paymentService)
	financeHandler := handlers.NewFinanceHandler(financeService, lanService)
	crmHandler := handlers.NewCRMHandler(crmService, lanService)
	staffHandler := handlers.NewStaffHandler(staffService)
	statsHandler := handlers.NewStatsHandler(statsService, lanService)
	printHandler := handlers.NewPrintHandler(printService)
	backupHandler := handlers.NewBackupHandler(backupService)
	settingsHandler := handlers.NewSettingsHandler(settingsService)
	lanHandler := handlers.NewLanHandler(lanService)
	cloudHandler := handlers.NewCloudHandler(cloudService)
	discountHandler := handlers.NewDiscountHandler(discountService, lanService)

	return &App{
		ProductHandler:  productHandler,
		SaleHandler:     saleHandler,
		PaymentHandler:  paymentHandler,
		FinanceHandler:  financeHandler,
		CRMHandler:      crmHandler,
		StaffHandler:    staffHandler,
		StatsHandler:    statsHandler,
		PrintHandler:    printHandler,
		BackupHandler:   backupHandler,
		SettingsHandler: settingsHandler,
		LanHandler:      lanHandler,
		CloudHandler:    cloudHandler,
		DiscountHandler: discountHandler,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.ProductHandler.Startup(ctx)
	a.SaleHandler.Startup(ctx)
	a.PaymentHandler.Startup(ctx)
	a.FinanceHandler.Startup(ctx)
	a.CRMHandler.Startup(ctx)
	a.StaffHandler.Startup(ctx)
	a.StatsHandler.Startup(ctx)
	a.PrintHandler.Startup(ctx)
	a.BackupHandler.Startup(ctx)
	a.SettingsHandler.Startup(ctx)
	a.LanHandler.Startup(ctx)
	a.CloudHandler.Startup(ctx)
	a.DiscountHandler.Startup(ctx)

	// 🔄 Start background update checker
	updater.StartAutoUpdateCheck()

	// 🖼️ Start Image Server for serving product images from filesystem
	if err := imagestore.StartImageServer(); err != nil {
		fmt.Printf("Warning: Could not start image server: %v\n", err)
	}

	// 🔄 One-time migration: Move Base64 images from DB to filesystem
	go func() {
		migrated, err := a.BackupHandler.MigrateImagesToFilesystem()
		if err != nil {
			fmt.Printf("Image migration error: %v\n", err)
		} else if migrated > 0 {
			fmt.Printf("✅ Migrated %d images to filesystem\n", migrated)
		}
	}()
}

// GetCSVTemplate returns a template string for CSV product import
func (a *App) GetCSVTemplate() string {
	return "Name,Barcode,Price,Cost,Stock,MinStock,Category,WholesalePrice,Description\n" +
		"Example Product,123456789,10.00,5.00,100,10,Snacks,8.50,A delicious snack\n"
}

// ExportProductsCSV exports all products to a CSV string
func (a *App) ExportProductsCSV() (*domain.CSVExportResult, error) {
	products, err := a.ProductHandler.GetAllProducts()
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write header
	header := []string{"Name", "Barcode", "Price", "Cost", "Stock", "MinStock", "Category", "WholesalePrice", "Description"}
	if err := writer.Write(header); err != nil {
		return nil, err
	}

	for _, p := range products {
		row := []string{
			p.Name,
			p.Barcode,
			fmt.Sprintf("%.2f", p.Price.Float()),
			fmt.Sprintf("%.2f", p.Cost.Float()),
			fmt.Sprintf("%.2f", p.Stock),
			fmt.Sprintf("%.2f", p.MinStock),
			p.Category,
			fmt.Sprintf("%.2f", p.WholesalePrice.Float()),
			p.Description,
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}
	writer.Flush()

	return &domain.CSVExportResult{
		Data:     buf.String(),
		Filename: fmt.Sprintf("products_export_%d.csv", time.Now().Unix()),
		Count:    len(products),
	}, nil
}

// ImportProductsCSV imports products from a CSV string
func (a *App) ImportProductsCSV(csvData string, updateExisting bool) (*domain.CSVImportResult, error) {
	reader := csv.NewReader(strings.NewReader(csvData))
	records, err := reader.ReadAll()
	if err != nil {
		return &domain.CSVImportResult{Success: false, Errors: []string{err.Error()}}, nil
	}

	if len(records) < 2 {
		return &domain.CSVImportResult{Success: false, Errors: []string{"الملف فارغ أو لا يحتوي على بيانات"}}, nil
	}

	header := records[0]
	colIndices := make(map[string]int)
	for i, col := range header {
		colIndices[strings.ToLower(strings.TrimSpace(col))] = i
	}

	// Required columns
	required := []string{"name", "price"}
	for _, req := range required {
		if _, ok := colIndices[req]; !ok {
			return &domain.CSVImportResult{
				Success: false,
				Errors:  []string{fmt.Sprintf("العمود المطلوب غير موجود: %s", req)},
			}, nil
		}
	}

	result := &domain.CSVImportResult{
		TotalRows:   len(records) - 1,
		Errors:      []string{},
		ImportedIDs: []string{},
	}

	// Pre-fetch all products once to build a barcode lookup map (avoids O(n²) DB calls per row)
	barcodeIndex := make(map[string]*domain.Product)
	if updateExisting {
		allProducts, err := a.ProductHandler.GetAllProducts()
		if err == nil {
			for i := range allProducts {
				if allProducts[i].Barcode != "" {
					p := allProducts[i]
					barcodeIndex[p.Barcode] = &p
				}
			}
		}
	}

	for rowIndex := 1; rowIndex < len(records); rowIndex++ {
		row := records[rowIndex]
		if len(row) < len(header) {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("السطر %d: عدد الأعمدة غير مطابق للترويسة", rowIndex+1))
			continue
		}

		getVal := func(key string) string {
			if idx, ok := colIndices[key]; ok && idx < len(row) {
				return strings.TrimSpace(row[idx])
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
		wholesalePriceStr := getVal("wholesaleprice")
		description := getVal("description")

		if name == "" {
			result.Skipped++
			result.Errors = append(result.Errors, fmt.Sprintf("السطر %d: الاسم مطلوب", rowIndex+1))
			continue
		}

		priceVal, _ := strconv.ParseFloat(priceStr, 64)
		costVal, _ := strconv.ParseFloat(costStr, 64)
		stockVal, _ := strconv.ParseFloat(stockStr, 64)
		minStockVal, _ := strconv.ParseFloat(minStockStr, 64)
		wholesalePriceVal, _ := strconv.ParseFloat(wholesalePriceStr, 64)

		price := domain.NewAmount(priceVal)
		cost := domain.NewAmount(costVal)
		wholesalePrice := domain.NewAmount(wholesalePriceVal)

		var existing *domain.Product
		if barcode != "" {
			existing = barcodeIndex[barcode]
		}

		if existing != nil {
			if !updateExisting {
				result.Skipped++
				result.Errors = append(result.Errors, fmt.Sprintf("السطر %d: المنتج موجود بالفعل بالباركود %s", rowIndex+1, barcode))
				continue
			}

			existing.Name = name
			existing.Price = price
			existing.Cost = cost
			existing.Stock = stockVal
			existing.MinStock = minStockVal
			existing.Category = category
			existing.WholesalePrice = wholesalePrice
			existing.Description = description

			err = a.ProductHandler.UpdateProduct(*existing)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("السطر %d: فشل في تحديث المنتج: %s", rowIndex+1, err.Error()))
				continue
			}
			result.Updated++
			result.ImportedIDs = append(result.ImportedIDs, existing.ID)
		} else {
			prodID := "prod_" + uuid.New().String()
			p := domain.Product{
				ID:             prodID,
				Name:           name,
				Barcode:        barcode,
				Price:          price,
				Cost:           cost,
				Stock:          stockVal,
				MinStock:       minStockVal,
				Category:       category,
				WholesalePrice: wholesalePrice,
				Description:    description,
			}
			err = a.ProductHandler.CreateProduct(p)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("السطر %d: فشل في إضافة المنتج: %s", rowIndex+1, err.Error()))
				continue
			}
			result.Imported++
			result.ImportedIDs = append(result.ImportedIDs, prodID)
		}
	}

	result.Success = len(result.Errors) == 0
	return result, nil
}

// ExportProductsCSVNative prompts the user with SaveFileDialog and writes the products CSV directly to disk
func (a *App) ExportProductsCSVNative() (*domain.CSVExportResult, error) {
	res, err := a.ExportProductsCSV()
	if err != nil {
		return nil, err
	}

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
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
func (a *App) DownloadProductsTemplateNative() (bool, error) {
	templateStr := a.GetCSVTemplate()

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
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
func (a *App) ImportProductsCSVNative(updateExisting bool) (*domain.CSVImportResult, error) {
	openPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
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

	return a.ImportProductsCSV(string(csvData), updateExisting)
}

// ExportDatabaseBackupNative prompts the user with SaveFileDialog and exports a database backup JSON to disk
func (a *App) ExportDatabaseBackupNative() (bool, error) {
	data, err := a.BackupHandler.ExportDatabase()
	if err != nil {
		return false, err
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return false, fmt.Errorf("failed to marshal backup data: %w", err)
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	defaultFilename := fmt.Sprintf("beidar_backup_%s.json", timestamp)

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
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
func (a *App) ImportDatabaseBackupNative() (bool, error) {
	openPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
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

	if err := a.BackupHandler.ImportDatabase(data); err != nil {
		return false, fmt.Errorf("failed to restore backup: %w", err)
	}

	return true, nil
}

// CalculateInstallmentPlan calculates the installment plan details

func (a *App) CalculateInstallmentPlan(total, downPayment float64, months int) (*domain.InstallmentPlan, error) {
	return a.PaymentHandler.CalculateInstallmentPlan(total, downPayment, months)
}

// GetLicenseUserDetails retrieves license details for a user
func (a *App) GetLicenseUserDetails(userID string) (*domain.UserDetails, error) {
	return a.CloudHandler.GetLicenseUserDetails(userID)
}

// GetBackupConfig retrieves current backup/sync config
func (a *App) GetBackupConfig() (map[string]interface{}, error) {
	prefs, err := a.SettingsHandler.GetPreferences()
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"cloudAutoSync": prefs.CloudAutoSync,
	}, nil
}

// SetCloudAutoSync updates the cloud auto sync preference
func (a *App) SetCloudAutoSync(enabled bool) error {
	prefs, err := a.SettingsHandler.GetPreferences()
	if err != nil {
		return err
	}
	prefs.CloudAutoSync = enabled
	return a.SettingsHandler.UpdatePreferences(*prefs)
}

// GetInstallmentAlertSummary calculates overdue installments metrics
func (a *App) GetInstallmentAlertSummary() (map[string]interface{}, error) {
	customers, err := a.CRMHandler.GetCustomers()
	if err != nil {
		return nil, err
	}
	customerMap := make(map[string]domain.Customer)
	for _, c := range customers {
		customerMap[c.ID] = c
	}

	salesResult, err := a.SaleHandler.GetSales(1, 100000, "", "", "")
	if err != nil {
		return nil, err
	}

	var totalOverdue int64
	var totalAmount float64
	byDay := map[string]int64{
		"1-7":  0,
		"8-30": 0,
		"30+":  0,
	}

	type InstallmentAlert struct {
		SaleID        string  `json:"saleId"`
		CustomerID    string  `json:"customerId"`
		CustomerName  string  `json:"customerName"`
		CustomerPhone string  `json:"customerPhone"`
		InstNumber    int     `json:"instNumber"`
		DueDate       string  `json:"dueDate"`
		Amount        float64 `json:"amount"`
		DaysOverdue   int     `json:"daysOverdue"`
		TotalDue      float64 `json:"totalDue"`
	}

	alerts := []InstallmentAlert{}
	customerOverdueDebt := make(map[string]float64)
	customerOverdueCount := make(map[string]int)

	today := time.Now().Truncate(24 * time.Hour)

	for _, sale := range salesResult.Data {
		if sale.InstallmentPlan == nil {
			continue
		}

		var totalDueForSale float64
		for _, inst := range sale.InstallmentPlan.Schedule {
			if inst.Status != "paid" {
				totalDueForSale += inst.Amount.Float()
			}
		}

		for _, inst := range sale.InstallmentPlan.Schedule {
			if inst.Status == "paid" {
				continue
			}

			dueTime, err := time.Parse("2006-01-02", inst.DueDate)
			if err != nil {
				continue
			}

			if dueTime.Before(today) {
				daysOverdue := int(today.Sub(dueTime).Hours() / 24)
				if daysOverdue <= 0 {
					continue
				}

				totalOverdue++
				amtFloat := inst.Amount.Float()
				totalAmount += amtFloat

				if daysOverdue <= 7 {
					byDay["1-7"]++
				} else if daysOverdue <= 30 {
					byDay["8-30"]++
				} else {
					byDay["30+"]++
				}

				phone := ""
				custName := sale.CustomerName
				if c, ok := customerMap[sale.CustomerID]; ok {
					phone = c.Phone
					if custName == "" {
						custName = c.Name
					}
				}

				alerts = append(alerts, InstallmentAlert{
					SaleID:        sale.ID,
					CustomerID:    sale.CustomerID,
					CustomerName:  custName,
					CustomerPhone: phone,
					InstNumber:    inst.Number,
					DueDate:       inst.DueDate,
					Amount:        amtFloat,
					DaysOverdue:   daysOverdue,
					TotalDue:      totalDueForSale,
				})

				customerOverdueDebt[sale.CustomerID] += amtFloat
				customerOverdueCount[sale.CustomerID]++
			}
		}
	}

	type TopCustomer struct {
		CustomerID   string  `json:"customerId"`
		CustomerName string  `json:"customerName"`
		TotalDebt    float64 `json:"totalDebt"`
		OverdueCount int     `json:"overdueCount"`
	}

	topCustomers := []TopCustomer{}
	for cID, debt := range customerOverdueDebt {
		name := ""
		if c, ok := customerMap[cID]; ok {
			name = c.Name
		}
		topCustomers = append(topCustomers, TopCustomer{
			CustomerID:   cID,
			CustomerName: name,
			TotalDebt:    debt,
			OverdueCount: customerOverdueCount[cID],
		})
	}

	sort.Slice(topCustomers, func(i, j int) bool {
		return topCustomers[i].TotalDebt > topCustomers[j].TotalDebt
	})

	if len(topCustomers) > 5 {
		topCustomers = topCustomers[:5]
	}

	return map[string]interface{}{
		"totalOverdue": totalOverdue,
		"totalAmount":  totalAmount,
		"byDay":        byDay,
		"topCustomers": topCustomers,
		"alerts":       alerts,
	}, nil
}

// AI_GenerateStream streams generation response from Gemini API
func (a *App) AI_GenerateStream(prompt string) error {
	prefs, err := a.SettingsHandler.GetPreferences()
	if err != nil {
		return fmt.Errorf("failed to load preferences: %w", err)
	}

	apiKey := prefs.GeminiAPIKey
	if apiKey == "" && len(prefs.GeminiAPIKeys) > 0 {
		apiKey = prefs.GeminiAPIKeys[0]
	}

	if apiKey == "" {
		apiKey = os.Getenv("GEMINI_API_KEY")
	}

	if apiKey == "" {
		return fmt.Errorf("يرجى إدخال مفتاح Gemini API في الإعدادات أولاً")
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				runtime.EventsEmit(a.ctx, "ai-stream-error", fmt.Sprintf("Panic: %v", r))
			}
		}()

		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=%s", apiKey)

		reqBody := map[string]interface{}{
			"contents": []map[string]interface{}{
				{
					"parts": []map[string]interface{}{
						{"text": prompt},
					},
				},
			},
		}

		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			runtime.EventsEmit(a.ctx, "ai-stream-error", "فشل في تشفير طلب الذكاء الاصطناعي: "+err.Error())
			return
		}

		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			runtime.EventsEmit(a.ctx, "ai-stream-error", "فشل في إنشاء طلب HTTP: "+err.Error())
			return
		}
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{
			Timeout: 60 * time.Second,
		}

		resp, err := client.Do(req)
		if err != nil {
			runtime.EventsEmit(a.ctx, "ai-stream-error", "فشل الاتصال بخدمة الذكاء الاصطناعي: "+err.Error())
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			runtime.EventsEmit(a.ctx, "ai-stream-error", fmt.Sprintf("خطأ من خادم Gemini (Status %d): %s", resp.StatusCode, string(bodyBytes)))
			return
		}

		bufReader := bufio.NewReader(resp.Body)
		var firstByte byte
		for {
			b, err := bufReader.ReadByte()
			if err != nil {
				runtime.EventsEmit(a.ctx, "ai-stream-error", "فشل قراءة الاستجابة: "+err.Error())
				return
			}
			if b != ' ' && b != '\t' && b != '\r' && b != '\n' {
				firstByte = b
				break
			}
		}

		err = bufReader.UnreadByte()
		if err != nil {
			runtime.EventsEmit(a.ctx, "ai-stream-error", "فشل تهيئة القارئ: "+err.Error())
			return
		}

		dec := json.NewDecoder(bufReader)

		type GeminiChunk struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}

		if firstByte == '[' {
			_, _ = dec.Token()
			for dec.More() {
				var chunk GeminiChunk
				if err := dec.Decode(&chunk); err != nil {
					runtime.EventsEmit(a.ctx, "ai-stream-error", "خطأ أثناء تحليل النص: "+err.Error())
					return
				}
				if len(chunk.Candidates) > 0 && len(chunk.Candidates[0].Content.Parts) > 0 {
					textChunk := chunk.Candidates[0].Content.Parts[0].Text
					if textChunk != "" {
						runtime.EventsEmit(a.ctx, "ai-stream-chunk", textChunk)
					}
				}
			}
			_, _ = dec.Token()
		} else {
			var chunk GeminiChunk
			if err := dec.Decode(&chunk); err != nil {
				runtime.EventsEmit(a.ctx, "ai-stream-error", "خطأ أثناء تحليل النص: "+err.Error())
				return
			}
			if len(chunk.Candidates) > 0 && len(chunk.Candidates[0].Content.Parts) > 0 {
				textChunk := chunk.Candidates[0].Content.Parts[0].Text
				if textChunk != "" {
					runtime.EventsEmit(a.ctx, "ai-stream-chunk", textChunk)
				}
			}
		}

		runtime.EventsEmit(a.ctx, "ai-stream-complete", "")
	}()

	return nil
}
