// Package testutil provides shared test helpers for Beidar service and repository tests.
// It centralises common setup patterns to reduce code duplication and ensure
// all tests use in-memory SQLite for speed and isolation.
package testutil

import (
	"testing"

	"beidar-desktop/internal/core/domain"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// SetupDB opens an in-memory SQLite DB, migrates the given models,
// and returns the DB along with a cleanup func.
//
// Usage:
//
//	db, cleanup := testutil.SetupDB(t, &domain.Product{}, &domain.Sale{})
//	defer cleanup()
func SetupDB(t *testing.T, models ...interface{}) (*gorm.DB, func()) {
	t.Helper()

	dbName := "file:memdb-" + uuid.New().String() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dbName), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		t.Fatalf("testutil.SetupDB: failed to open in-memory DB: %v", err)
	}

	if len(models) > 0 {
		if err := db.AutoMigrate(models...); err != nil {
			t.Fatalf("testutil.SetupDB: AutoMigrate failed: %v", err)
		}
	}

	cleanup := func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			_ = sqlDB.Close()
		}
	}

	return db, cleanup
}

// SetupFullDB opens an in-memory SQLite DB migrated with ALL domain models.
// Use this when the service under test interacts with many tables.
func SetupFullDB(t *testing.T) (*gorm.DB, func()) {
	t.Helper()
	return SetupDB(t,
		&domain.Product{},
		&domain.Sale{},
		&domain.SaleItem{},
		&domain.Customer{},
		&domain.Supplier{},
		&domain.Expense{},
		&domain.Category{},
		&domain.StockMovement{},
		&domain.AppPreferences{},
		&domain.Payment{},
		&domain.ParkedSale{},
		&domain.LoginAttempt{},
		&domain.Staff{},
		&domain.Shift{},
		&domain.CashMovement{},
		&domain.PurchaseOrder{},
		&domain.PurchaseOrderItem{},
		&domain.BlockedDevice{},
		&domain.Discount{},
	)
}

// SeedPreferences inserts default AppPreferences into db (ID=1).
// Most service tests need a preferences row to succeed.
func SeedPreferences(t *testing.T, db *gorm.DB) {
	t.Helper()
	prefs := &domain.AppPreferences{
		ID:        1,
		StoreName: "متجر الاختبار",
		Currency:  "IQD",
	}
	if err := db.Create(prefs).Error; err != nil {
		t.Fatalf("testutil.SeedPreferences: failed to insert preferences: %v", err)
	}
}

// ─── Factory Helpers ────────────────────────────────────────────────────────

// NewProduct inserts a product with given name, price, and initial stock.
// It auto-generates a UUID and sets cost = price * 0.7.
func NewProduct(t *testing.T, db *gorm.DB, name string, price float64, stock float64) *domain.Product {
	t.Helper()
	p := &domain.Product{
		ID:    uuid.New().String(),
		Name:  name,
		Price: domain.NewAmount(price),
		Cost:  domain.NewAmount(price * 0.7),
		Stock: stock,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("testutil.NewProduct: failed to create product %q: %v", name, err)
	}
	return p
}

// NewCustomer inserts a customer with given name and initial debt (0 for debt-free).
func NewCustomer(t *testing.T, db *gorm.DB, name string, initialDebt float64) *domain.Customer {
	t.Helper()
	c := &domain.Customer{
		ID:    uuid.New().String(),
		Name:  name,
		Phone: uuid.New().String()[:10], // unique placeholder phone
		Debt:  domain.NewAmount(initialDebt),
	}
	if err := db.Create(c).Error; err != nil {
		t.Fatalf("testutil.NewCustomer: failed to create customer %q: %v", name, err)
	}
	return c
}

// MustRefreshCustomer re-fetches a Customer from the DB and fatals on error.
func MustRefreshCustomer(t *testing.T, db *gorm.DB, id string) *domain.Customer {
	t.Helper()
	var c domain.Customer
	if err := db.First(&c, "id = ?", id).Error; err != nil {
		t.Fatalf("testutil.MustRefreshCustomer: failed to reload customer %q: %v", id, err)
	}
	return &c
}

// MustRefreshProduct re-fetches a Product from the DB and fatals on error.
func MustRefreshProduct(t *testing.T, db *gorm.DB, id string) *domain.Product {
	t.Helper()
	var p domain.Product
	if err := db.First(&p, "id = ?", id).Error; err != nil {
		t.Fatalf("testutil.MustRefreshProduct: failed to reload product %q: %v", id, err)
	}
	return &p
}

// AmountEq checks if two Amounts differ by at most 1 cent (rounding tolerance).
func AmountEq(a, b domain.Amount) bool {
	return a.Sub(b).Abs().Cents() <= 1
}
