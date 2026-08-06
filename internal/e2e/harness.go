// Package e2e provides end-to-end tests that drive the application's public
// HTTP/handler surface (wails handlers) against a fully-wired stack of real
// repositories, services and handlers backed by an in-memory SQLite database.
//
// The wiring mirrors app.go in the production root so that tests exercise the
// same dependency graph shipped to customers (handlers -> services ->
// repositories -> SQLite), rather than isolated mocks. Handlers are invoked
// directly as the public API, exactly as Wails would.
package e2e

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/handlers"
	"beidar-desktop/internal/integration"
	"beidar-desktop/internal/network"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"

	"gorm.io/gorm"
)

// Harness holds the fully-wired application graph for end-to-end tests.
type Harness struct {
	DB *gorm.DB
	t  *testing.T

	// Repositories (kept for direct assertions when needed).
	Repos *repos

	// Handlers are the public API under test.
	SaleHandler     *handlers.SaleHandler
	PaymentHandler  *handlers.PaymentHandler
	FinanceHandler  *handlers.FinanceHandler
	CRMHandler      *handlers.CRMHandler
	StaffHandler    *handlers.StaffHandler
	StatsHandler    *handlers.StatsHandler
	ProductHandler  *handlers.ProductHandler
	PrintHandler    *handlers.PrintHandler
	BackupHandler   *handlers.BackupHandler
	SettingsHandler *handlers.SettingsHandler
	LanHandler      *handlers.LanHandler
	CloudHandler    *handlers.CloudHandler
	DiscountHandler *handlers.DiscountHandler
	AIHandler       *handlers.AIHandler

	Lan network.LanService
}

type repos struct {
	product     domain.ProductRepository
	sale        domain.SaleRepository
	customer    domain.CustomerRepository
	payment     domain.PaymentRepository
	shift       domain.ShiftRepository
	expense     domain.ExpenseRepository
	purchase    domain.PurchaseOrderRepository
	supplier    domain.SupplierRepository
	staff       domain.StaffRepository
	stats       domain.StatsRepository
	backup      domain.BackupRepository
	network     domain.NetworkRepository
	discount    domain.DiscountRepository
	preferences domain.PreferencesRepository
	audit       domain.AuditRepository
}

// NewHarness wires a fresh in-memory harness with the production service graph
// and returns it along with a cleanup func.
func NewHarness(t *testing.T) (*Harness, func()) {
	t.Helper()

	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	// Repositories.
	r := &repos{
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
		audit:       repository.NewAuditRepository(db),
	}

	// Services — same construction order as app.go/initServices.
	productService := service.NewProductService(r.product)
	saleService := service.NewSaleService(
		r.sale, r.product, r.customer, r.payment, r.shift,
		r.preferences, productService, r.audit,
	)
	paymentService := service.NewPaymentService(
		r.payment, r.customer, r.sale, r.shift, r.preferences,
	)
	financeService := service.NewFinanceService(
		r.expense, r.shift, r.purchase, r.supplier, r.product,
		r.preferences, productService,
	)
	crmService := service.NewCRMService(r.customer, r.supplier, r.product)
	staffService := service.NewStaffService(r.staff)
	statsService := service.NewStatsService(r.stats)
	printService := service.NewPrintService(r.sale, r.preferences)
	backupService := service.NewBackupService(r.backup, r.product)
	settingsService := service.NewSettingsService(r.preferences)
	discountService := service.NewDiscountService(r.discount)
	lanService := network.NewLanService(
		r.network, productService, saleService, crmService, financeService,
		statsService, settingsService, backupService, staffService,
	)
	cloudService := integration.NewCloudService(r.preferences, r.sale, r.staff)
	aiService := service.NewAIService(settingsService)

	// Handlers — same iniHandlers wiring.
	app := &Harness{
		DB:              db,
		t:               t,
		Repos:           r,
		ProductHandler:  handlers.NewProductHandler(productService, lanService),
		SaleHandler:     handlers.NewSaleHandler(saleService, lanService),
		PaymentHandler:  handlers.NewPaymentHandler(paymentService),
		FinanceHandler:  handlers.NewFinanceHandler(financeService, lanService, backupService, cloudService),
		CRMHandler:      handlers.NewCRMHandler(crmService, lanService),
		StaffHandler:    handlers.NewStaffHandler(staffService, cloudService),
		StatsHandler:    handlers.NewStatsHandler(statsService, lanService),
		PrintHandler:    handlers.NewPrintHandler(printService),
		BackupHandler:   handlers.NewBackupHandler(backupService),
		SettingsHandler: handlers.NewSettingsHandler(settingsService),
		LanHandler:      handlers.NewLanHandler(lanService),
		CloudHandler:    handlers.NewCloudHandler(cloudService),
		DiscountHandler: handlers.NewDiscountHandler(discountService, lanService),
		AIHandler:       handlers.NewAIHandler(aiService),
		Lan:             lanService,
	}

	// Mirror the app's SeedDefaultAdmin behaviour so an admin exists.
	if err := staffService.SeedDefaultAdmin(); err != nil {
		t.Fatalf("e2e harness: SeedDefaultAdmin failed: %v", err)
	}

	return app, cleanup
}

// LoginAsAdmin activates an admin session so handler auth checks pass.
// Must be paired with DeferLogout.
func (h *Harness) LoginAsAdmin(t *testing.T) {
	t.Helper()
	staff, err := h.Repos.staff.GetByUsername(AdminUsername)
	if err != nil {
		t.Fatalf("e2e harness: admin user not found: %v", err)
	}
	auth.Set(staff, nil)
}

// DeferLogout clears the auth session. Use together with LoginAsAdmin.
func (h *Harness) DeferLogout() {
	auth.Clear()
}