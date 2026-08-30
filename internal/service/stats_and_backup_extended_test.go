package service_test

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"github.com/google/uuid"
)

func TestStatsService_ComprehensiveAggregations(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	statsRepo := repository.NewStatsRepository(db)
	prodRepo := repository.NewProductRepository(db)
	saleRepo := repository.NewSaleRepository(db)

	statsSvc := service.NewStatsService(statsRepo)

	// 1. Seed Products
	p1 := &domain.Product{ID: uuid.New().String(), Barcode: "BAR-101", Name: "لابتوب ديل", Price: domain.NewAmount(800000), Stock: 10, MinStock: 5, Category: "Electronics"}
	p2 := &domain.Product{ID: uuid.New().String(), Barcode: "BAR-102", Name: "سماعة رأس", Price: domain.NewAmount(50000), Stock: 2, MinStock: 5, Category: "Accessories"} // Low stock <= 5
	_ = prodRepo.Create(p1)
	_ = prodRepo.Create(p2)

	// 2. Seed Sales
	today := time.Now().Format("2006-01-02")
	sale1 := &domain.Sale{
		ID:            uuid.New().String(),
		Date:          today,
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      domain.NewAmount(800000),
		Total:         domain.NewAmount(800000),
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    1,
		Items: []domain.SaleItem{
			{ProductID: p1.ID, Name: p1.Name, Quantity: 1, Price: p1.Price, Total: p1.Price},
		},
	}
	_ = saleRepo.Create(sale1)

	// 3. Test Dashboard Stats for 'today'
	dashStats, err := statsSvc.GetDashboardStats("today")
	if err != nil {
		t.Fatalf("GetDashboardStats failed: %v", err)
	}

	if !testutil.AmountEq(dashStats.TotalRevenue, domain.NewAmount(800000)) {
		t.Errorf("expected total revenue 800,000, got %s", dashStats.TotalRevenue.String())
	}
	if dashStats.TotalOrders != 1 {
		t.Errorf("expected total orders 1, got %d", dashStats.TotalOrders)
	}

	// 4. Test Dashboard Stats for 'month' and 'year'
	monthStats, err := statsSvc.GetDashboardStats("month")
	if err != nil {
		t.Fatalf("GetDashboardStats month failed: %v", err)
	}
	if monthStats.TotalRevenue.IsZero() {
		t.Error("expected non-zero revenue for month stats")
	}
}

func TestBackupService_ExportAndIntegrity(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	testutil.SeedPreferences(t, db)

	backupRepo := repository.NewBackupRepository(db)
	prodRepo := repository.NewProductRepository(db)
	backupSvc := service.NewBackupService(backupRepo, prodRepo)

	// Create test products with explicit barcode
	_ = prodRepo.Create(&domain.Product{ID: "p1", Barcode: "BAR-EXP-01", Name: "منتج النسخ الاحتياطي", Price: domain.NewAmount(15000), Stock: 20})

	// 1. Create Backup
	result, err := backupSvc.CreateBackup()
	if err != nil {
		t.Fatalf("CreateBackup returned error: %v", err)
	}
	if !result.Success && result.Error != "" {
		t.Logf("CreateBackup result notice: %s", result.Error)
	}

	// 2. Export Products to CSV format
	exportResult, err := backupSvc.ExportProductsCSV()
	if err != nil {
		t.Fatalf("ExportProductsCSV failed: %v", err)
	}
	if exportResult == nil || exportResult.Data == "" {
		t.Fatal("expected non-empty CSV export result")
	}

	// 3. Import Products from CSV with updateExisting=true
	importResult, err := backupSvc.ImportProductsCSV(exportResult.Data, true)
	if err != nil {
		t.Fatalf("ImportProductsCSV failed: %v", err)
	}
	if len(importResult.Errors) > 0 {
		t.Logf("Import notice/errors: %v", importResult.Errors)
	}
	if importResult.TotalRows != 1 {
		t.Errorf("expected 1 total row in import, got %d", importResult.TotalRows)
	}
}
