package service_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"
	"beidar-desktop/pkg/secureconfig"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ─── Decorators reproducing one failing write each ──────────────────────────

// failAuditRepo rejects every audit write, reproducing a failed insert of the
// audit entry that now shares the sale's/return's own transaction.
type failAuditRepo struct {
	domain.AuditRepository
}

func (f failAuditRepo) Log(*domain.AuditLog) error {
	return errors.New("simulated audit write failure")
}

func (f failAuditRepo) WithTx(tx domain.Tx) domain.AuditRepository {
	return failAuditRepo{AuditRepository: f.AuditRepository.WithTx(tx)}
}

// failUpdateStaffRepo rejects staff row updates only; reads pass through.
type failUpdateStaffRepo struct {
	domain.StaffRepository
}

func (f failUpdateStaffRepo) Update(*domain.Staff) error {
	return errors.New("simulated staff update failure")
}

// failSecondGetActiveStaffRepo serves the first GetActive for real (so the
// empty roster triggers the default-admin seed) and fails the refresh read
// that follows it.
type failSecondGetActiveStaffRepo struct {
	domain.StaffRepository
	getActiveCalls int
}

func (f *failSecondGetActiveStaffRepo) GetActive() ([]domain.Staff, error) {
	f.getActiveCalls++
	if f.getActiveCalls >= 2 {
		return nil, errors.New("simulated staff read failure")
	}
	return f.StaffRepository.GetActive()
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// setupSwallowedErrorDB builds the financial fixture set including the audit
// table, because sale and return transactions now require their audit entries
// to be committed together with them.
func setupSwallowedErrorDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, cleanup := testutil.SetupDB(t,
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Payment{},
		&domain.StockMovement{}, &domain.Shift{}, &domain.CashMovement{}, &domain.Staff{},
		&domain.AppPreferences{}, &domain.LoginAttempt{}, &domain.Supplier{}, &domain.Category{},
		&domain.ParkedSale{}, &domain.AuditLog{},
	)
	t.Cleanup(cleanup)
	testutil.SeedPreferences(t, db)
	return db
}

func saleServiceWithAudit(t *testing.T, db *gorm.DB, audit domain.AuditRepository) domain.SaleService {
	t.Helper()
	prefRepo := repository.NewPreferencesRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	productRepo := repository.NewProductRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	productService := service.NewProductService(productRepo)
	return service.NewSaleService(saleRepo, productRepo, customerRepo, paymentRepo, shiftRepo, prefRepo, productService, audit)
}

// cashSaleFixture opens a shift and returns a customer, a product and a
// ready-to-process cash sale used by the audit rollback tests.
func cashSaleFixture(t *testing.T, db *gorm.DB, shiftID string) (*domain.Customer, *domain.Product, domain.Sale) {
	t.Helper()
	fflOpenShift(t, db, shiftID)
	customer := createTestCustomer(t, db, "Audit Customer", 0)
	product := createTestProduct(t, db, "Audit Item", 100, 10)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(100),
		Total:         domain.NewAmount(100),
		PaymentMethod: "cash",
		Status:        "pending",
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(100),
			Total:     domain.NewAmount(100),
		}},
	}
	return customer, product, sale
}

// ─── Sale discount audit ────────────────────────────────────────────────────

// TestProcessSale_DiscountAuditFailureRollsBack asserts that a discounted sale
// is not committed when its audit entry cannot be written: before the fix the
// audit error was swallowed and the sale closed with no record of who applied
// the discount.
func TestProcessSale_DiscountAuditFailureRollsBack(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	_, product, sale := cashSaleFixture(t, db, "shift-audit-sale")
	sale.Discount = domain.NewAmount(10)
	sale.Total = domain.NewAmount(90)

	saleService := saleServiceWithAudit(t, db, failAuditRepo{AuditRepository: repository.NewAuditRepository(db)})

	auth.Set(&domain.Staff{Role: domain.RoleAdmin}, nil)
	defer auth.Clear()

	if err := saleService.ProcessSale(&sale); err == nil {
		t.Fatal("expected ProcessSale to fail when the discount audit entry cannot be written")
	}

	var stored domain.Sale
	if err := db.First(&stored, "id = ?", sale.ID).Error; err == nil {
		t.Error("sale must not be persisted when its audit entry failed")
	}

	var p domain.Product
	if err := db.First(&p, "id = ?", product.ID).Error; err != nil {
		t.Fatalf("reload product: %v", err)
	}
	if p.Stock != 10 {
		t.Errorf("product stock = %v, want 10 — the sale must roll back entirely", p.Stock)
	}

	shift := fflLoadShift(t, db, "shift-audit-sale")
	if !amountEq(shift.TotalSales, domain.Zero()) {
		t.Errorf("shift total sales = %s, want 0 after the rollback", shift.TotalSales.String())
	}
}

// ─── Return audits ──────────────────────────────────────────────────────────

// TestReturnSale_AuditFailureRollsBack asserts that a full return aborts when
// its audit entry fails, instead of marking the invoice returned with no audit
// trail.
func TestReturnSale_AuditFailureRollsBack(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	_, product, sale := cashSaleFixture(t, db, "shift-audit-return")
	healthy := saleServiceWithAudit(t, db, repository.NewAuditRepository(db))
	if err := healthy.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale: %v", err)
	}

	breaking := saleServiceWithAudit(t, db, failAuditRepo{AuditRepository: repository.NewAuditRepository(db)})
	if err := breaking.ReturnSale(sale.ID); err == nil {
		t.Fatal("expected ReturnSale to fail when the audit entry cannot be written")
	}

	var stored domain.Sale
	if err := db.First(&stored, "id = ?", sale.ID).Error; err != nil {
		t.Fatalf("reload sale: %v", err)
	}
	if stored.Status == "returned" {
		t.Error("sale must not be marked returned when its audit entry failed")
	}

	var p domain.Product
	if err := db.First(&p, "id = ?", product.ID).Error; err != nil {
		t.Fatalf("reload product: %v", err)
	}
	if p.Stock != 9 {
		t.Errorf("product stock = %v, want 9 — the stock restore must roll back", p.Stock)
	}

	if refunds := fflRefundPayments(t, db, sale.ID); len(refunds) != 0 {
		t.Errorf("refund payments = %d, want 0 after the rollback", len(refunds))
	}

	shift := fflLoadShift(t, db, "shift-audit-return")
	if !amountEq(shift.TotalSales, domain.NewAmount(100)) {
		t.Errorf("shift total sales = %s, want the sale still counted (100)", shift.TotalSales.String())
	}
}

// TestReturnSalePartial_AuditFailureRollsBack asserts the same atomicity for
// partial returns.
func TestReturnSalePartial_AuditFailureRollsBack(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	_, product, sale := cashSaleFixture(t, db, "shift-audit-partial")
	healthy := saleServiceWithAudit(t, db, repository.NewAuditRepository(db))
	if err := healthy.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale: %v", err)
	}

	breaking := saleServiceWithAudit(t, db, failAuditRepo{AuditRepository: repository.NewAuditRepository(db)})
	if err := breaking.ReturnSalePartial(sale.ID, product.ID, 1); err == nil {
		t.Fatal("expected ReturnSalePartial to fail when the audit entry cannot be written")
	}

	var stored domain.Sale
	if err := db.First(&stored, "id = ?", sale.ID).Error; err != nil {
		t.Fatalf("reload sale: %v", err)
	}
	if stored.Status == "partial_return" {
		t.Error("sale must not be marked partially returned when its audit entry failed")
	}

	var p domain.Product
	if err := db.First(&p, "id = ?", product.ID).Error; err != nil {
		t.Fatalf("reload product: %v", err)
	}
	if p.Stock != 9 {
		t.Errorf("product stock = %v, want 9 — the partial return must roll back", p.Stock)
	}
}

// ─── Staff persistence ──────────────────────────────────────────────────────

// TestSeedDefaultAdmin_HealUpdateFailurePropagates asserts the admin self-heal
// no longer reports success when the password reset was never persisted.
func TestSeedDefaultAdmin_HealUpdateFailurePropagates(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	admin := domain.Staff{
		ID:            uuid.New().String(),
		Name:          "المدير",
		Username:      "admin",
		Role:          domain.RoleAdmin,
		Active:        true,
		MustChangePin: true,
		LastLogin:     0,
		PasswordHash:  "stale-hash",
	}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	svc := service.NewStaffService(&failUpdateStaffRepo{StaffRepository: repository.NewStaffRepository(db)})
	if err := svc.SeedDefaultAdmin(); err == nil {
		t.Fatal("expected SeedDefaultAdmin to surface the failed heal write")
	}
}

// TestAuthenticateByUsername_BookkeepingFailureDoesNotBlockLogin asserts the
// LastLogin timestamp is bookkeeping only: a failed write is logged (the
// decorator fails every update) and never blocks an already-verified login.
func TestAuthenticateByUsername_BookkeepingFailureDoesNotBlockLogin(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	hash, err := bcrypt.GenerateFromPassword([]byte("Secret123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	cashier := domain.Staff{
		ID:           uuid.New().String(),
		Name:         "Cashier One",
		Username:     "cashier1",
		Role:         domain.RoleCashier,
		Active:       true,
		PasswordHash: string(hash),
		Permissions:  domain.RolePermissions[domain.RoleCashier],
	}
	if err := db.Create(&cashier).Error; err != nil {
		t.Fatalf("seed cashier: %v", err)
	}

	svc := service.NewStaffService(&failUpdateStaffRepo{StaffRepository: repository.NewStaffRepository(db)})
	result, err := svc.AuthenticateByUsername("cashier1", "Secret123")
	if err != nil {
		t.Fatalf("AuthenticateByUsername: %v", err)
	}
	if result == nil || !result.Success {
		t.Error("login must succeed even when the LastLogin write fails")
	}
}

// TestGetActiveStaff_RefreshFailurePropagates asserts the roster refresh after
// the default-admin seed surfaces its read error instead of silently replacing
// the roster with an empty slice.
func TestGetActiveStaff_RefreshFailurePropagates(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	repo := &failSecondGetActiveStaffRepo{StaffRepository: repository.NewStaffRepository(db)}
	svc := service.NewStaffService(repo)

	if _, err := svc.GetActiveStaff(); err == nil {
		t.Fatal("expected GetActiveStaff to surface the refresh read failure")
	}
	if repo.getActiveCalls < 2 {
		t.Fatalf("expected the refresh to read GetActive twice, got %d calls", repo.getActiveCalls)
	}
}

// ─── Cloud AI settings ──────────────────────────────────────────────────────

// withSupabaseEnv points the settings service at a mock Supabase URL and
// restores the previous environment afterwards.
func withSupabaseEnv(t *testing.T, url string) {
	t.Helper()
	oldURL, oldKey := os.Getenv("BEIDAR_SUPABASE_URL"), os.Getenv("BEIDAR_SUPABASE_KEY")
	t.Cleanup(func() {
		if oldURL != "" {
			os.Setenv("BEIDAR_SUPABASE_URL", oldURL)
		} else {
			os.Unsetenv("BEIDAR_SUPABASE_URL")
		}
		if oldKey != "" {
			os.Setenv("BEIDAR_SUPABASE_KEY", oldKey)
		} else {
			os.Unsetenv("BEIDAR_SUPABASE_KEY")
		}
		secureconfig.ResetCache()
	})
	os.Setenv("BEIDAR_SUPABASE_URL", url)
	os.Setenv("BEIDAR_SUPABASE_KEY", "test-sb-key")
	secureconfig.ResetCache()
}

// TestSaveGlobalGroqKeys_MalformedConfigDoesNotWipeKeys asserts a corrupted
// existing ai_keys row aborts the save instead of PATCHing an empty config that
// would wipe the other providers' keys.
func TestSaveGlobalGroqKeys_MalformedConfigDoesNotWipeKeys(t *testing.T) {
	svc, _, cleanup := setupSettingsTestDB(t)
	defer cleanup()

	patched := false
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/v1/global_settings" {
			switch r.Method {
			case http.MethodGet:
				w.Header().Set("Content-Type", "application/json")
				// Valid JSON whose `value` cannot be decoded into the keys
				// config — exactly what a corrupted row looks like.
				_, _ = w.Write([]byte(`[{"id":"ai_keys","key":"ai_keys","value":123,"updated_at":"2026-06-12T12:00:00Z"}]`))
				return
			case http.MethodPatch:
				patched = true
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	withSupabaseEnv(t, mockServer.URL)

	if err := svc.SaveGlobalGroqKeys([]string{"groq-x"}, "test-user-token"); err == nil {
		t.Fatal("expected SaveGlobalGroqKeys to fail instead of overwriting a malformed config")
	}
	if patched {
		t.Error("no PATCH must be sent when the existing config cannot be parsed")
	}
}

// TestSaveGlobalGroqKeys_FetchFailureDoesNotWipeKeys asserts a failed fetch of
// the existing config aborts the save instead of PATCHing an empty config.
func TestSaveGlobalGroqKeys_FetchFailureDoesNotWipeKeys(t *testing.T) {
	svc, _, cleanup := setupSettingsTestDB(t)
	defer cleanup()

	patched := false
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/v1/global_settings" {
			switch r.Method {
			case http.MethodGet:
				w.WriteHeader(http.StatusInternalServerError)
				return
			case http.MethodPatch:
				patched = true
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	withSupabaseEnv(t, mockServer.URL)

	if err := svc.SaveGlobalGroqKeys([]string{"groq-x"}, "test-user-token"); err == nil {
		t.Fatal("expected SaveGlobalGroqKeys to fail when the existing config cannot be fetched")
	}
	if patched {
		t.Error("no PATCH must be sent when the existing config could not be fetched")
	}
}

// ─── Staff seeding (GetActiveStaff self-heal) ─────────────────────────────

// failSeedStaffRepo fails the first GetStaffCount inside SeedDefaultAdmin —
// the count-0 seed path — while leaving reads and Create untouched. This
// isolates the seed itself from unrelated write paths.
type failSeedStaffRepo struct {
	domain.StaffRepository
}

func (f failSeedStaffRepo) GetStaffCount() (int64, error) {
	return 0, errors.New("simulated staff count failure")
}

// TestGetActiveStaff_SeedFailurePropagates asserts that a failing default-admin
// seed is logged and propagated: the empty roster is not silently returned as
// an unusable-but-successful empty list.
func TestGetActiveStaff_SeedFailurePropagates(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	repo := &failSeedStaffRepo{StaffRepository: repository.NewStaffRepository(db)}
	svc := service.NewStaffService(repo)

	if _, err := svc.GetActiveStaff(); err == nil {
		t.Fatal("expected GetActiveStaff to propagate the failed default-admin seed")
	}
}

// ─── Staff self-heal: reads versus "no admin" ───────────────────────────────

// legacyInactiveStaff returns a deactivated cashier whose username is not
// "admin". The roster therefore looks empty to GetActiveStaff (so the seed runs)
// while the staff table is not empty (so the seed takes the heal branch).
func legacyInactiveStaff() domain.Staff {
	return domain.Staff{
		ID:       uuid.New().String(),
		Name:     "موظف قديم",
		Username: "legacy-cashier",
		Role:     domain.RoleCashier,
		Active:   false,
	}
}

// failHealReadStaffRepo fails the admin lookup used by the self-heal path while
// leaving the count and every other read real, so only the heal branch breaks.
type failHealReadStaffRepo struct {
	domain.StaffRepository
}

func (f failHealReadStaffRepo) GetByUsername(string) (*domain.Staff, error) {
	return nil, errors.New("simulated staff read failure")
}

// TestSeedDefaultAdmin_HealReadFailurePropagates asserts a failed read of the
// admin row is not mistaken for "there is no admin to heal": before the fix the
// raw read error was collapsed into a nil return, so the caller was told the
// admin was usable although nothing had been read at all.
func TestSeedDefaultAdmin_HealReadFailurePropagates(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	legacy := legacyInactiveStaff()
	if err := db.Create(&legacy).Error; err != nil {
		t.Fatalf("seed legacy staff: %v", err)
	}

	svc := service.NewStaffService(failHealReadStaffRepo{StaffRepository: repository.NewStaffRepository(db)})
	if err := svc.SeedDefaultAdmin(); err == nil {
		t.Fatal("expected SeedDefaultAdmin to surface the failed admin read")
	}
}

// TestGetActiveStaff_MissingAdminRow_HealsSilently asserts the counterpart of
// the test above: a genuinely absent admin row must stay a silent no-op. This
// also pins the repository contract the healer relies on — an absent row must
// surface as domain.ErrRecordNotFound, never as a raw gorm error.
func TestGetActiveStaff_MissingAdminRow_HealsSilently(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	legacy := legacyInactiveStaff()
	if err := db.Create(&legacy).Error; err != nil {
		t.Fatalf("seed legacy staff: %v", err)
	}

	svc := service.NewStaffService(repository.NewStaffRepository(db))
	staff, err := svc.GetActiveStaff()
	if err != nil {
		t.Fatalf("GetActiveStaff must stay silent when no admin row exists: %v", err)
	}
	if len(staff) != 0 {
		t.Errorf("active roster = %d rows, want 0 (every seeded staff is inactive)", len(staff))
	}
}

// countingSeedStaffRepo counts GetStaffCount calls and fails them, so any
// attempt to seed on a healthy roster becomes visible.
type countingSeedStaffRepo struct {
	domain.StaffRepository
	countCalls int
}

func (c *countingSeedStaffRepo) GetStaffCount() (int64, error) {
	c.countCalls++
	return 0, errors.New("seed must not run on a healthy roster")
}

// TestGetActiveStaff_HealthyRosterNeverSeeds asserts the fail-closed seed path
// cannot reach a working install: with an active staff row present the roster is
// returned as-is and the seed is never attempted.
func TestGetActiveStaff_HealthyRosterNeverSeeds(t *testing.T) {
	db := setupSwallowedErrorDB(t)

	active := domain.Staff{
		ID:           uuid.New().String(),
		Name:         "Cashier Active",
		Username:     "cashier-active",
		Role:         domain.RoleCashier,
		Active:       true,
		PasswordHash: "stored-hash",
	}
	if err := db.Create(&active).Error; err != nil {
		t.Fatalf("seed active staff: %v", err)
	}

	repo := &countingSeedStaffRepo{StaffRepository: repository.NewStaffRepository(db)}
	svc := service.NewStaffService(repo)

	staff, err := svc.GetActiveStaff()
	if err != nil {
		t.Fatalf("GetActiveStaff: %v", err)
	}
	if len(staff) != 1 || staff[0].ID != active.ID {
		t.Fatalf("active roster = %d rows, want the single active staff", len(staff))
	}
	if repo.countCalls != 0 {
		t.Errorf("GetStaffCount called %d times on a healthy roster, want 0", repo.countCalls)
	}
}
