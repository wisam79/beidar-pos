package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/handlers"
	"beidar-desktop/internal/integration"
	"beidar-desktop/internal/network"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/pkg/auth"
	"beidar-desktop/pkg/imagestore"
	"beidar-desktop/pkg/updater"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/gorm"
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
	AIHandler       *handlers.AIHandler
	productRepo     domain.ProductRepository
	productService  domain.ProductService
	paymentService  domain.PaymentService
}

type appRepositories struct {
	preferences domain.PreferencesRepository
	customer    domain.CustomerRepository
	product     domain.ProductRepository
	shift       domain.ShiftRepository
	sale        domain.SaleRepository
	payment     domain.PaymentRepository
	expense     domain.ExpenseRepository
	purchase    domain.PurchaseOrderRepository
	supplier    domain.SupplierRepository
	staff       domain.StaffRepository
	stats       domain.StatsRepository
	backup      domain.BackupRepository
	network     domain.NetworkRepository
	discount    domain.DiscountRepository
}

type appServices struct {
	product  domain.ProductService
	sale     domain.SaleService
	payment  domain.PaymentService
	finance  domain.FinanceService
	crm      domain.CRMService
	staff    domain.StaffService
	stats    domain.StatsService
	print    domain.PrintService
	backup   domain.BackupService
	settings domain.SettingsService
	discount domain.DiscountService
	lan      network.LanService
	cloud    integration.CloudService
	ai       domain.AIService
}

func initDatabase() (*gorm.DB, error) {
	return repository.InitDB()
}

func initRepositories(db *gorm.DB) *appRepositories {
	return &appRepositories{
		preferences: repository.NewPreferencesRepository(db),
		customer:    repository.NewCustomerRepository(db),
		product:     repository.NewProductRepository(db),
		shift:       repository.NewShiftRepository(db),
		sale:        repository.NewSaleRepository(db),
		payment:     repository.NewPaymentRepository(db),
		expense:     repository.NewExpenseRepository(db),
		purchase:    repository.NewPurchaseOrderRepository(db),
		supplier:    repository.NewSupplierRepository(db),
		staff:       repository.NewStaffRepository(db),
		stats:       repository.NewStatsRepository(db),
		backup:      repository.NewBackupRepository(db),
		network:     repository.NewNetworkRepository(db),
		discount:    repository.NewDiscountRepository(db),
	}
}

func initServices(repos *appRepositories) *appServices {
	productService := service.NewProductService(repos.product)
	saleService := service.NewSaleService(
		repos.sale,
		repos.product,
		repos.customer,
		repos.payment,
		repos.shift,
		repos.preferences,
		productService,
	)
	paymentService := service.NewPaymentService(
		repos.payment,
		repos.customer,
		repos.sale,
		repos.shift,
		repos.preferences,
	)
	financeService := service.NewFinanceService(
		repos.expense,
		repos.shift,
		repos.purchase,
		repos.supplier,
		repos.product,
		repos.preferences,
		productService,
	)
	crmService := service.NewCRMService(
		repos.customer,
		repos.supplier,
		repos.product,
	)
	staffService := service.NewStaffService(
		repos.staff,
	)
	statsService := service.NewStatsService(
		repos.stats,
	)
	printService := service.NewPrintService(
		repos.sale,
		repos.preferences,
	)
	backupService := service.NewBackupService(
		repos.backup,
		repos.product,
	)
	settingsService := service.NewSettingsService(
		repos.preferences,
	)
	discountService := service.NewDiscountService(
		repos.discount,
	)
	lanService := network.NewLanService(
		repos.network,
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

	cloudService := integration.NewCloudService(repos.preferences, repos.sale, repos.staff)
	aiService := service.NewAIService(settingsService)

	return &appServices{
		product:  productService,
		sale:     saleService,
		payment:  paymentService,
		finance:  financeService,
		crm:      crmService,
		staff:    staffService,
		stats:    statsService,
		print:    printService,
		backup:   backupService,
		settings: settingsService,
		discount: discountService,
		lan:      lanService,
		cloud:    cloudService,
		ai:       aiService,
	}
}

func initHandlers(services *appServices, repos *appRepositories) *App {
	return &App{
		ProductHandler:  handlers.NewProductHandler(services.product, services.lan),
		SaleHandler:     handlers.NewSaleHandler(services.sale, services.lan),
		PaymentHandler:  handlers.NewPaymentHandler(services.payment),
		FinanceHandler:  handlers.NewFinanceHandler(services.finance, services.lan),
		CRMHandler:      handlers.NewCRMHandler(services.crm, services.lan),
		StaffHandler:    handlers.NewStaffHandler(services.staff),
		StatsHandler:    handlers.NewStatsHandler(services.stats, services.lan),
		PrintHandler:    handlers.NewPrintHandler(services.print),
		BackupHandler:   handlers.NewBackupHandler(services.backup),
		SettingsHandler: handlers.NewSettingsHandler(services.settings),
		LanHandler:      handlers.NewLanHandler(services.lan),
		CloudHandler:    handlers.NewCloudHandler(services.cloud),
		DiscountHandler: handlers.NewDiscountHandler(services.discount, services.lan),
		AIHandler:       handlers.NewAIHandler(services.ai),
		productRepo:     repos.product,
		productService:  services.product,
		paymentService:  services.payment,
	}
}

// NewApp creates a new App application struct
func NewApp() *App {
	db, err := initDatabase()
	if err != nil {
		panic("فشل في تهيئة قاعدة البيانات: " + err.Error())
	}

	repos := initRepositories(db)
	services := initServices(repos)
	return initHandlers(services, repos)
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
	a.AIHandler.Startup(ctx)

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
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return nil, err
	}
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
	if err := auth.RequirePermission(auth.PermProducts); err != nil {
		return nil, err
	}
	res, err := a.BackupHandler.ImportProductsCSV(csvData, updateExisting)
	if err == nil && a.productService != nil {
		a.productService.ClearCache()
	}
	return res, err
}

// ExportProductsCSVNative prompts the user with SaveFileDialog and writes the products CSV directly to disk
func (a *App) ExportProductsCSVNative() (*domain.CSVExportResult, error) {
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return nil, err
	}
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
	if err := auth.Require(); err != nil {
		return false, err
	}
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
	if err := auth.RequirePermission(auth.PermProducts); err != nil {
		return nil, err
	}
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
	if err := auth.RequirePermission(auth.PermExportData); err != nil {
		return false, err
	}
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
	if err := auth.RequireAdmin(); err != nil {
		return false, err
	}
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



// GetBackupConfig retrieves current backup/sync config
func (a *App) GetBackupConfig() (*domain.BackupConfig, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	prefs, err := a.SettingsHandler.GetPreferences()
	if err != nil {
		return nil, err
	}
	return &domain.BackupConfig{
		CloudAutoSync: prefs.CloudAutoSync,
	}, nil
}

// SetCloudAutoSync updates the cloud auto sync preference
func (a *App) SetCloudAutoSync(enabled bool) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	prefs, err := a.SettingsHandler.GetPreferences()
	if err != nil {
		return err
	}
	prefs.CloudAutoSync = enabled
	return a.SettingsHandler.UpdatePreferences(*prefs)
}

// GetInstallmentAlertSummary calculates overdue installments metrics (backward-compatible wrapper)
func (a *App) GetInstallmentAlertSummary() (map[string]interface{}, error) {
	if err := auth.RequirePermission(auth.PermReports); err != nil {
		return nil, err
	}
	summary, err := a.paymentService.GetInstallmentAlertSummary()
	if err != nil {
		return nil, err
	}

	// Map domain.InstallmentAlertSummary to the exact structure the frontend expects
	type InstallmentAlertCompatible struct {
		SaleID        string  `json:"saleId"`
		CustomerID    string  `json:"customerId"`
		CustomerName  string  `json:"customerName"`
		CustomerPhone string  `json:"customerPhone"`
		InstNumber    int     `json:"instNumber"`
		DueDate       string  `json:"dueDate"`
		Amount        float64 `json:"amount"` // float64 for frontend compatibility
		DaysOverdue   int     `json:"daysOverdue"`
		TotalDue      float64 `json:"totalDue"` // float64 for frontend compatibility
	}

	type TopCustomerCompatible struct {
		CustomerID   string  `json:"customerId"`
		CustomerName string  `json:"customerName"`
		TotalDebt    float64 `json:"totalDebt"` // float64 for frontend compatibility
		OverdueCount int     `json:"overdueCount"`
	}

	alerts := make([]InstallmentAlertCompatible, len(summary.Alerts))
	for i, alert := range summary.Alerts {
		alerts[i] = InstallmentAlertCompatible{
			SaleID:        alert.SaleID,
			CustomerID:    alert.CustomerID,
			CustomerName:  alert.CustomerName,
			CustomerPhone: alert.CustomerPhone,
			InstNumber:    alert.InstNumber,
			DueDate:       alert.DueDate,
			Amount:        alert.Amount.Float(),
			DaysOverdue:   alert.DaysOverdue,
			TotalDue:      alert.TotalDue.Float(),
		}
	}

	topCustomers := make([]TopCustomerCompatible, len(summary.TopCustomers))
	for i, customer := range summary.TopCustomers {
		topCustomers[i] = TopCustomerCompatible{
			CustomerID:   customer.CustomerID,
			CustomerName: customer.CustomerName,
			TotalDebt:    customer.TotalDebt.Float(),
			OverdueCount: customer.OverdueCount,
		}
	}

	return map[string]interface{}{
		"totalOverdue": summary.TotalOverdue,
		"totalAmount":  summary.TotalAmount.Float(),
		"byDay":        summary.ByDay,
		"topCustomers": topCustomers,
		"alerts":       alerts,
	}, nil
}

// AI_GenerateStream streams generation response from Gemini API (backward-compatible proxy)
func (a *App) AI_GenerateStream(prompt string) error {
	return a.AIHandler.AI_GenerateStream(prompt)
}

// AI_CancelStream cancels the current AI generation stream (backward-compatible proxy)
func (a *App) AI_CancelStream() {
	a.AIHandler.AI_CancelStream()
}
