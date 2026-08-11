package repository

import (
	"sync"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestCustomerRepo_DecrementDebt_BelowZeroGuard(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Customer{})
	defer cleanup()

	repo := NewCustomerRepository(db)

	customer := &domain.Customer{
		ID:              "cust-debt-edge",
		Name:            "Kareem",
		Phone:           "07809998877",
		Debt:            domain.NewAmount(500), // 50,000 cents
		InstallmentDebt: domain.NewAmount(200), // 20,000 cents
	}
	if err := repo.Create(customer); err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	// 1. Decrement normal debt by partial amount (200.00 -> leaves 300.00)
	if err := repo.DecrementDebt("cust-debt-edge", domain.NewAmount(200)); err != nil {
		t.Fatalf("DecrementDebt partial failed: %v", err)
	}
	c1, err := repo.GetByID("cust-debt-edge")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if c1.Debt != domain.NewAmount(300) {
		t.Errorf("Debt after partial decrement = %s, want 300.00", c1.Debt)
	}

	// 2. Decrement debt by amount exceeding current debt (400.00 > 300.00) -> must clamp at Zero
	if err := repo.DecrementDebt("cust-debt-edge", domain.NewAmount(400)); err != nil {
		t.Fatalf("DecrementDebt exceeding failed: %v", err)
	}
	c2, err := repo.GetByID("cust-debt-edge")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if c2.Debt != domain.Zero() {
		t.Errorf("Debt after exceeding decrement = %s, want 0.00 (clamped)", c2.Debt)
	}

	// 3. Decrement on zero debt -> must remain Zero
	if err := repo.DecrementDebt("cust-debt-edge", domain.NewAmount(50)); err != nil {
		t.Fatalf("DecrementDebt on zero debt failed: %v", err)
	}
	c3, err := repo.GetByID("cust-debt-edge")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if c3.Debt != domain.Zero() {
		t.Errorf("Debt after zero decrement = %s, want 0.00", c3.Debt)
	}

	// 4. Test DecrementInstallmentDebt guard below zero
	if err := repo.DecrementInstallmentDebt("cust-debt-edge", domain.NewAmount(300)); err != nil {
		t.Fatalf("DecrementInstallmentDebt exceeding failed: %v", err)
	}
	c4, err := repo.GetByID("cust-debt-edge")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if c4.InstallmentDebt != domain.Zero() {
		t.Errorf("InstallmentDebt after exceeding decrement = %s, want 0.00", c4.InstallmentDebt)
	}
}

func TestCustomerRepo_AdjustPoints_NegativeDelta(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Customer{})
	defer cleanup()

	repo := NewCustomerRepository(db)

	customer := &domain.Customer{
		ID:     "cust-pts-edge",
		Name:   "Hassan",
		Phone:  "07705554433",
		Points: 100,
	}
	if err := repo.Create(customer); err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	// 1. Positive adjustment (+50 -> 150)
	if err := repo.AdjustPoints("cust-pts-edge", 50); err != nil {
		t.Fatalf("Positive AdjustPoints failed: %v", err)
	}
	c1, _ := repo.GetByID("cust-pts-edge")
	if c1.Points != 150 {
		t.Errorf("Points = %d, want 150", c1.Points)
	}

	// 2. Negative adjustment within balance (-40 -> 110)
	if err := repo.AdjustPoints("cust-pts-edge", -40); err != nil {
		t.Fatalf("Negative AdjustPoints failed: %v", err)
	}
	c2, _ := repo.GetByID("cust-pts-edge")
	if c2.Points != 110 {
		t.Errorf("Points = %d, want 110", c2.Points)
	}

	// 3. Negative adjustment exceeding current balance (-200 on 110 points -> must clamp to 0)
	if err := repo.AdjustPoints("cust-pts-edge", -200); err != nil {
		t.Fatalf("Exceeding negative AdjustPoints failed: %v", err)
	}
	c3, _ := repo.GetByID("cust-pts-edge")
	if c3.Points != 0 {
		t.Errorf("Points after large deduction = %d, want 0 (clamped)", c3.Points)
	}

	// 4. Negative adjustment on 0 points -> remains 0
	if err := repo.AdjustPoints("cust-pts-edge", -25); err != nil {
		t.Fatalf("Negative AdjustPoints on 0 failed: %v", err)
	}
	c4, _ := repo.GetByID("cust-pts-edge")
	if c4.Points != 0 {
		t.Errorf("Points after negative on 0 = %d, want 0", c4.Points)
	}
}

func TestCustomerRepo_ConcurrentAdjustPoints(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.Customer{})
	defer cleanup()

	repo := NewCustomerRepository(db)

	customer := &domain.Customer{
		ID:     "cust-concurrent-pts",
		Name:   "Concurrent Tester",
		Phone:  "07907776655",
		Points: 1000,
	}
	if err := repo.Create(customer); err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	goroutines := 10
	iterations := 20
	deltaPerIteration := 5
	totalExpectedDelta := goroutines * iterations * deltaPerIteration // 10 * 20 * 5 = 1000

	var wg sync.WaitGroup
	wg.Add(goroutines)

	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				if err := repo.AdjustPoints("cust-concurrent-pts", deltaPerIteration); err != nil {
					t.Errorf("AdjustPoints concurrent error: %v", err)
				}
			}
		}()
	}

	wg.Wait()

	finalCust, err := repo.GetByID("cust-concurrent-pts")
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}

	expectedPoints := 1000 + totalExpectedDelta
	if finalCust.Points != expectedPoints {
		t.Errorf("Final points = %d, want %d (lost updates detected)", finalCust.Points, expectedPoints)
	}
}
