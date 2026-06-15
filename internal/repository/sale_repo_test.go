package repository

import (
	"beidar-desktop/internal/core/domain"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupSaleTestDB(t *testing.T) (domain.SaleRepository, *gorm.DB, func()) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}
	if err := db.AutoMigrate(
		&domain.Sale{}, &domain.SaleItem{}, &domain.ParkedSale{},
	); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}
	repo := NewSaleRepository(db)
	return repo, db, func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}
}

func TestSaleRepository_Create(t *testing.T) {
	repo, _, cleanup := setupSaleTestDB(t)
	defer cleanup()

	sale := &domain.Sale{
		ID:    "sale_1",
		Total: domain.NewAmount(100),
		Items: []domain.SaleItem{
			{ProductID: "p1", Name: "Item 1", Price: domain.NewAmount(50), Quantity: 2, Total: domain.NewAmount(100)},
		},
	}
	if err := repo.Create(sale); err != nil {
		t.Fatalf("Failed to create sale: %v", err)
	}

	got, err := repo.GetByID("sale_1")
	if err != nil {
		t.Fatalf("Failed to get sale: %v", err)
	}
	if got.Total != domain.NewAmount(100) {
		t.Errorf("Total = %s, want 100.00", got.Total)
	}
	if len(got.Items) != 1 {
		t.Errorf("Items count = %d, want 1", len(got.Items))
	}
}

func TestSaleRepository_GetSales_Pagination(t *testing.T) {
	repo, _, cleanup := setupSaleTestDB(t)
	defer cleanup()

	for i := 0; i < 5; i++ {
		sale := &domain.Sale{
			ID:    "sale_" + string(rune('0'+i)),
			Total: domain.NewAmount(10),
		}
		if err := repo.Create(sale); err != nil {
			t.Fatalf("Failed to create sale: %v", err)
		}
	}

	result, err := repo.GetSales(0, 2, "", "", "")
	if err != nil {
		t.Fatalf("GetSales failed: %v", err)
	}
	if result.Total != 5 {
		t.Errorf("Total = %d, want 5", result.Total)
	}
	if len(result.Data) != 2 {
		t.Errorf("Page size = %d, want 2", len(result.Data))
	}
	if result.TotalPages != 3 {
		t.Errorf("TotalPages = %d, want 3", result.TotalPages)
	}
}

func TestSaleRepository_ParkSale(t *testing.T) {
	repo, _, cleanup := setupSaleTestDB(t)
	defer cleanup()

	parked := &domain.ParkedSale{
		ItemsJSON:    `[{"id":"p1","qty":2}]`,
		CustomerName: "Test Customer",
		Total:        domain.NewAmount(50),
		ItemsCount:   2,
	}
	if err := repo.ParkSale(parked); err != nil {
		t.Fatalf("Failed to park sale: %v", err)
	}
	if parked.ID == 0 {
		t.Error("Parked sale ID should be auto-assigned")
	}

	retrieved, err := repo.RetrieveParkedSale(parked.ID)
	if err != nil {
		t.Fatalf("Failed to retrieve parked sale: %v", err)
	}
	if retrieved.CustomerName != "Test Customer" {
		t.Errorf("CustomerName = %q, want 'Test Customer'", retrieved.CustomerName)
	}
}

func TestSaleRepository_GetSales_StatusFilter(t *testing.T) {
	repo, _, cleanup := setupSaleTestDB(t)
	defer cleanup()

	sales := []*domain.Sale{
		{ID: "s1", Total: domain.NewAmount(10), Status: "completed"},
		{ID: "s2", Total: domain.NewAmount(20), Status: "returned"},
		{ID: "s3", Total: domain.NewAmount(30), Status: "completed"},
	}
	for _, s := range sales {
		if err := repo.Create(s); err != nil {
			t.Fatalf("Failed to create sale: %v", err)
		}
	}

	result, err := repo.GetSales(0, 10, "", "returned", "")
	if err != nil {
		t.Fatalf("GetSales failed: %v", err)
	}
	if result.Total != 1 {
		t.Errorf("Filtered total = %d, want 1", result.Total)
	}
}

func TestSaleRepository_DeleteParkedSale(t *testing.T) {
	repo, _, cleanup := setupSaleTestDB(t)
	defer cleanup()

	parked := &domain.ParkedSale{
		ItemsJSON: `[]`,
		Total:     domain.NewAmount(0),
	}
	if err := repo.ParkSale(parked); err != nil {
		t.Fatalf("Failed to park sale: %v", err)
	}

	if err := repo.DeleteParkedSale(parked.ID); err != nil {
		t.Fatalf("Failed to delete parked sale: %v", err)
	}

	count, err := repo.GetParkedSalesCount()
	if err != nil {
		t.Fatalf("GetParkedSalesCount failed: %v", err)
	}
	if count != 0 {
		t.Errorf("Count = %d, want 0 after delete", count)
	}
}

func TestSaleRepository_GetInstallmentSales(t *testing.T) {
	repo, _, cleanup := setupSaleTestDB(t)
	defer cleanup()

	sales := []*domain.Sale{
		{ID: "s1", Total: domain.NewAmount(100), PaymentMethod: "installment"},
		{ID: "s2", Total: domain.NewAmount(200), PaymentMethod: "cash"},
		{ID: "s3", Total: domain.NewAmount(300), PaymentMethod: "installment"},
	}
	for _, s := range sales {
		if err := repo.Create(s); err != nil {
			t.Fatalf("Failed to create sale: %v", err)
		}
	}

	installmentSales, err := repo.GetInstallmentSales()
	if err != nil {
		t.Fatalf("GetInstallmentSales failed: %v", err)
	}
	if len(installmentSales) != 2 {
		t.Errorf("Installment sales count = %d, want 2", len(installmentSales))
	}
}
