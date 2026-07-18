package testutil_test

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestSetupDB_InMemory(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Product{}, &domain.Customer{})
	defer cleanup()

	if db == nil {
		t.Fatal("SetupDB returned nil *gorm.DB")
	}

	// Verify table was created by inserting a row
	p := &domain.Product{
		ID:    "test-id",
		Name:  "Test Product",
		Price: domain.NewAmount(100),
		Stock: 10,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("SetupDB: cannot insert product: %v", err)
	}

	var found domain.Product
	if err := db.First(&found, "id = ?", "test-id").Error; err != nil {
		t.Fatalf("SetupDB: cannot retrieve product: %v", err)
	}
	if found.Name != "Test Product" {
		t.Errorf("Name = %q, want 'Test Product'", found.Name)
	}
}

func TestSetupFullDB_MigratesAll(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	// Spot-check: confirm both Product and Staff tables exist
	if !db.Migrator().HasTable(&domain.Product{}) {
		t.Error("SetupFullDB should have Product table")
	}
	if !db.Migrator().HasTable(&domain.Staff{}) {
		t.Error("SetupFullDB should have Staff table")
	}
	if !db.Migrator().HasTable(&domain.Discount{}) {
		t.Error("SetupFullDB should have Discount table")
	}
}

func TestSeedPreferences(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.AppPreferences{})
	defer cleanup()

	testutil.SeedPreferences(t, db)

	var prefs domain.AppPreferences
	if err := db.First(&prefs).Error; err != nil {
		t.Fatalf("SeedPreferences: row not found: %v", err)
	}
	if prefs.StoreName != "متجر الاختبار" {
		t.Errorf("StoreName = %q, want 'متجر الاختبار'", prefs.StoreName)
	}
	if prefs.Currency != "IQD" {
		t.Errorf("Currency = %q, want 'IQD'", prefs.Currency)
	}
}

func TestNewProduct(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Product{}, &domain.StockMovement{})
	defer cleanup()

	p := testutil.NewProduct(t, db, "Keyboard", 15000, 5)

	if p.ID == "" {
		t.Error("NewProduct: ID should be auto-generated UUID")
	}
	if p.Name != "Keyboard" {
		t.Errorf("NewProduct: Name = %q, want 'Keyboard'", p.Name)
	}
	if p.Price != domain.NewAmount(15000) {
		t.Errorf("NewProduct: Price = %s, want 15000", p.Price)
	}
	if p.Stock != 5 {
		t.Errorf("NewProduct: Stock = %f, want 5", p.Stock)
	}
}

func TestNewCustomer(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Customer{})
	defer cleanup()

	c := testutil.NewCustomer(t, db, "Ahmed Ali", 50000)

	if c.ID == "" {
		t.Error("NewCustomer: ID should be auto-generated UUID")
	}
	if c.Name != "Ahmed Ali" {
		t.Errorf("NewCustomer: Name = %q, want 'Ahmed Ali'", c.Name)
	}
	if c.Debt != domain.NewAmount(50000) {
		t.Errorf("NewCustomer: Debt = %s, want 50000.00", c.Debt)
	}
}

func TestMustRefreshCustomer(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Customer{})
	defer cleanup()

	c := testutil.NewCustomer(t, db, "Sara", 0)

	// Modify directly
	db.Model(c).Update("name", "Sara Updated")

	refreshed := testutil.MustRefreshCustomer(t, db, c.ID)
	if refreshed.Name != "Sara Updated" {
		t.Errorf("MustRefreshCustomer: Name = %q, want 'Sara Updated'", refreshed.Name)
	}
}

func TestMustRefreshProduct(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Product{}, &domain.StockMovement{})
	defer cleanup()

	p := testutil.NewProduct(t, db, "Mouse", 10000, 20)

	// Modify stock directly
	db.Model(p).Update("stock", 15)

	refreshed := testutil.MustRefreshProduct(t, db, p.ID)
	if refreshed.Stock != 15 {
		t.Errorf("MustRefreshProduct: Stock = %f, want 15", refreshed.Stock)
	}
}

func TestAmountEq(t *testing.T) {
	tests := []struct {
		a, b domain.Amount
		want bool
	}{
		{domain.NewAmount(100), domain.NewAmount(100), true},
		{domain.NewAmount(100), domain.NewAmount(100.005), true}, // within 1 cent tolerance
		{domain.NewAmount(100), domain.NewAmount(101), false},
		{domain.Zero(), domain.Zero(), true},
		{domain.NewAmount(-50), domain.NewAmount(-50), true},
	}
	for _, tt := range tests {
		got := testutil.AmountEq(tt.a, tt.b)
		if got != tt.want {
			t.Errorf("AmountEq(%s, %s) = %v, want %v", tt.a, tt.b, got, tt.want)
		}
	}
}
