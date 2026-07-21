package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/handlers"
	"beidar-desktop/internal/integration"
	"beidar-desktop/internal/network"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
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
	backupService   domain.BackupService
	cloudService    integration.CloudService
	ForceClose      bool
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
		FinanceHandler:  handlers.NewFinanceHandler(services.finance, services.lan, services.backup, services.cloud),
		CRMHandler:      handlers.NewCRMHandler(services.crm, services.lan),
		StaffHandler:    handlers.NewStaffHandler(services.staff, services.cloud),
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
		backupService:   services.backup,
		cloudService:    services.cloud,
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

	// ⚡ Trigger Supabase Keep-Alive ping to prevent project suspension
	go a.CloudHandler.KeepAliveSupabase()

	// 🛡️ Start Automated Backups Worker
	go a.startAutomatedBackups()
}

// ForceQuit forces the application to close bypassing the custom dialog
func (a *App) ForceCloseApp() {
	a.ForceClose = true
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	} else {
		os.Exit(0)
	}
}

// startAutomatedBackups runs in a background goroutine and triggers a backup every 12 hours.
func (a *App) startAutomatedBackups() {
	ticker := time.NewTicker(12 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			fmt.Println("🛡️ Running automated background backup...")
			if a.backupService != nil {
				_, err := a.backupService.CreateBackup()
				if err != nil {
					fmt.Printf("⚠️ Automated local backup failed: %v\n", err)
				} else {
					fmt.Println("✅ Automated local backup succeeded.")
					_, _ = a.backupService.CleanOldBackups(7)
				}
			}
			if a.cloudService != nil && a.cloudService.IsLoggedIn() {
				err := a.cloudService.CloudBackupNow()
				if err != nil {
					fmt.Printf("⚠️ Automated cloud backup failed: %v\n", err)
				} else {
					fmt.Println("✅ Automated cloud backup succeeded.")
				}
			}
		}
	}
}

// MinimizeWindow minimizes the application window
func (a *App) MinimizeWindow() {
	runtime.WindowMinimise(a.ctx)
}
