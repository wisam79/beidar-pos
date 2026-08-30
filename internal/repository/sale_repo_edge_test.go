package repository

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"

	"gorm.io/gorm"
)

func TestSaleRepo_GetForUpdate_LockAcquired(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Sale{}, &domain.SaleItem{})
	defer cleanup()

	repo := NewSaleRepository(db)

	sale := &domain.Sale{
		ID:           "sale-lock-001",
		CustomerName: "Ali",
		Total:        domain.NewAmount(150),
		Subtotal:     domain.NewAmount(150),
		Status:       "pending",
		Items: []domain.SaleItem{
			{SaleID: "sale-lock-001", ProductID: "p1", Name: "Item A", Price: domain.NewAmount(50), Quantity: 1, Total: domain.NewAmount(50)},
			{SaleID: "sale-lock-001", ProductID: "p2", Name: "Item B", Price: domain.NewAmount(100), Quantity: 1, Total: domain.NewAmount(100)},
		},
	}
	if err := repo.Create(sale); err != nil {
		t.Fatalf("Failed to create sale: %v", err)
	}

	// 1. Acquire lock in transaction and update
	err := repo.Transaction(func(tx domain.Tx) error {
		txRepo := repo.WithTx(tx)

		lockedSale, err := txRepo.GetForUpdate("sale-lock-001")
		if err != nil {
			return fmt.Errorf("GetForUpdate failed: %w", err)
		}
		if lockedSale.ID != "sale-lock-001" {
			return fmt.Errorf("expected ID 'sale-lock-001', got %s", lockedSale.ID)
		}
		if len(lockedSale.Items) != 2 {
			return fmt.Errorf("expected 2 preloaded items, got %d", len(lockedSale.Items))
		}

		lockedSale.Status = "completed"
		return txRepo.Update(lockedSale)
	})
	if err != nil {
		t.Fatalf("Transaction with GetForUpdate failed: %v", err)
	}

	// 2. Verify updated status
	reloaded, err := repo.GetByID("sale-lock-001")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if reloaded.Status != "completed" {
		t.Errorf("Sale status = %q, want 'completed'", reloaded.Status)
	}

	// 3. GetForUpdate on nonexistent sale returns ErrRecordNotFound
	err = repo.Transaction(func(tx domain.Tx) error {
		txRepo := repo.WithTx(tx)
		_, err := txRepo.GetForUpdate("nonexistent-sale-id")
		return err
	})
	if !errors.Is(err, domain.ErrRecordNotFound) && err != gorm.ErrRecordNotFound {
		t.Errorf("Expected domain.ErrRecordNotFound for nonexistent sale, got %v", err)
	}
}

func TestSaleRepo_PaginationEdgeCases(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Sale{}, &domain.SaleItem{})
	defer cleanup()

	repo := NewSaleRepository(db)

	totalSales := 15
	for i := 1; i <= totalSales; i++ {
		s := &domain.Sale{
			ID:        fmt.Sprintf("sale-pag-%02d", i),
			Total:     domain.NewAmount(float64(i * 10)),
			Timestamp: int64(1700000000 + i*100),
		}
		if err := repo.Create(s); err != nil {
			t.Fatalf("Create sale failed: %v", err)
		}
	}

	// Edge Case 1: Page 0, pageSize = 0 -> Defaults to maxPageSize (200), returns all 15
	res, err := repo.GetSales(0, 0, "", "", "")
	if err != nil {
		t.Fatalf("GetSales(0, 0) failed: %v", err)
	}
	if res.Total != int64(totalSales) {
		t.Errorf("Total = %d, want %d", res.Total, totalSales)
	}
	if len(res.Data) != totalSales {
		t.Errorf("len(Data) = %d, want %d", len(res.Data), totalSales)
	}
	if res.TotalPages != 1 {
		t.Errorf("TotalPages = %d, want 1", res.TotalPages)
	}

	// Edge Case 2: Page 0, negative pageSize -> Defaults to maxPageSize (200)
	res, err = repo.GetSales(0, -10, "", "", "")
	if err != nil {
		t.Fatalf("GetSales(0, -10) failed: %v", err)
	}
	if len(res.Data) != totalSales {
		t.Errorf("len(Data) = %d, want %d", len(res.Data), totalSales)
	}

	// Edge Case 3: Out of bounds page -> Returns empty data, but correct total and totalPages
	res, err = repo.GetSales(100, 5, "", "", "")
	if err != nil {
		t.Fatalf("GetSales(100, 5) failed: %v", err)
	}
	if res.Total != int64(totalSales) {
		t.Errorf("Total = %d, want %d", res.Total, totalSales)
	}
	if res.TotalPages != 3 {
		t.Errorf("TotalPages = %d, want 3", res.TotalPages)
	}
	if len(res.Data) != 0 {
		t.Errorf("len(Data) for out of bounds page = %d, want 0", len(res.Data))
	}
	if res.Page != 100 {
		t.Errorf("Page = %d, want 100", res.Page)
	}

	// Edge Case 4: PageSize exceeds maxPageSize (500) -> Clamped to 200
	res, err = repo.GetSales(0, 500, "", "", "")
	if err != nil {
		t.Fatalf("GetSales(0, 500) failed: %v", err)
	}
	if len(res.Data) != totalSales {
		t.Errorf("len(Data) = %d, want %d", len(res.Data), totalSales)
	}

	// Edge Case 5: Exact last page (page 2 of 3 with pageSize=5)
	res, err = repo.GetSales(2, 5, "", "", "")
	if err != nil {
		t.Fatalf("GetSales(2, 5) failed: %v", err)
	}
	if len(res.Data) != 5 {
		t.Errorf("len(Data) on page 2 = %d, want 5", len(res.Data))
	}
}

func TestSaleRepo_FilterCombinations(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Sale{}, &domain.SaleItem{})
	defer cleanup()

	repo := NewSaleRepository(db)

	now := time.Now()
	y, m, d := now.Date()
	todayStart := time.Date(y, m, d, 10, 0, 0, 0, now.Location()).UnixMilli()
	fiveDaysAgo := now.AddDate(0, 0, -5).UnixMilli()
	monthAgo := now.AddDate(0, 0, -30).UnixMilli()

	sales := []*domain.Sale{
		// Today sales
		{ID: "s-today-ahmed-comp", CustomerName: "Ahmed Kareem", Status: "completed", Total: domain.NewAmount(100), Timestamp: todayStart},
		{ID: "s-today-ahmed-pend", CustomerName: "Ahmed Kareem", Status: "pending", Total: domain.NewAmount(50), Timestamp: todayStart + 1000},
		{ID: "s-today-ahmed-ret", CustomerName: "Ahmed Kareem", Status: "returned", Total: domain.NewAmount(30), Timestamp: todayStart + 2000},
		{ID: "s-today-sara-comp", CustomerName: "Sara Noor", Status: "completed", Total: domain.NewAmount(200), Timestamp: todayStart + 3000},
		// Past week sales
		{ID: "s-week-ahmed-comp", CustomerName: "Ahmed Kareem", Status: "completed", Total: domain.NewAmount(80), Timestamp: fiveDaysAgo},
		// Old sales (> 7 days)
		{ID: "s-old-ahmed-comp", CustomerName: "Ahmed Kareem", Status: "completed", Total: domain.NewAmount(90), Timestamp: monthAgo},
	}

	for _, s := range sales {
		if err := repo.Create(s); err != nil {
			t.Fatalf("Create sale failed: %v", err)
		}
	}

	// Filter Combination 1: status="completed", date="today", search="Ahmed"
	res1, err := repo.GetSales(0, 10, "Ahmed", "completed", "today")
	if err != nil {
		t.Fatalf("Filter 1 failed: %v", err)
	}
	if len(res1.Data) != 1 || res1.Data[0].ID != "s-today-ahmed-comp" {
		t.Errorf("Filter 1 Data mismatch: %+v", res1.Data)
	}
	if res1.Stats.Count != 1 || res1.Stats.Total != domain.NewAmount(100) {
		t.Errorf("Filter 1 Stats mismatch: Count=%d, Total=%s", res1.Stats.Count, res1.Stats.Total)
	}
	if res1.Stats.Returns != 0 || res1.Stats.Pending != domain.Zero() {
		t.Errorf("Filter 1 Stats returns/pending mismatch: Returns=%d, Pending=%s", res1.Stats.Returns, res1.Stats.Pending)
	}

	// Filter Combination 2: status="all", date="today", search="Ahmed"
	res2, err := repo.GetSales(0, 10, "Ahmed", "all", "today")
	if err != nil {
		t.Fatalf("Filter 2 failed: %v", err)
	}
	if len(res2.Data) != 3 {
		t.Errorf("Filter 2 Data count = %d, want 3", len(res2.Data))
	}
	if res2.Stats.Count != 3 {
		t.Errorf("Filter 2 Stats.Count = %d, want 3", res2.Stats.Count)
	}
	// Total excludes returned sales (100 completed + 50 pending = 150)
	if res2.Stats.Total != domain.NewAmount(150) {
		t.Errorf("Filter 2 Stats.Total = %s, want 150.00", res2.Stats.Total)
	}
	if res2.Stats.Pending != domain.NewAmount(50) {
		t.Errorf("Filter 2 Stats.Pending = %s, want 50.00", res2.Stats.Pending)
	}
	if res2.Stats.Returns != 1 {
		t.Errorf("Filter 2 Stats.Returns = %d, want 1", res2.Stats.Returns)
	}

	// Filter Combination 3: status="completed", date="week", search=""
	res3, err := repo.GetSales(0, 10, "", "completed", "week")
	if err != nil {
		t.Fatalf("Filter 3 failed: %v", err)
	}
	// Should include: s-today-ahmed-comp, s-today-sara-comp, s-week-ahmed-comp (3 sales)
	if len(res3.Data) != 3 {
		t.Errorf("Filter 3 Data count = %d, want 3", len(res3.Data))
	}
	// Total: 100 + 200 + 80 = 380
	if res3.Stats.Total != domain.NewAmount(380) {
		t.Errorf("Filter 3 Stats.Total = %s, want 380.00", res3.Stats.Total)
	}

	// Filter Combination 4: Nonexistent search term
	res4, err := repo.GetSales(0, 10, "NonExistentCustomerName", "", "")
	if err != nil {
		t.Fatalf("Filter 4 failed: %v", err)
	}
	if len(res4.Data) != 0 || res4.Total != 0 || res4.Stats.Count != 0 {
		t.Errorf("Filter 4 expected empty results, got Data=%d, Total=%d", len(res4.Data), res4.Total)
	}
}
