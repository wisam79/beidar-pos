package e2e

import (
	"sync"
	"sync/atomic"
	"testing"
)

// TestE2E_Concurrency_PessimisticLock_LastUnitRace verifies that when multiple
// concurrent transactions race to purchase the last remaining unit of a product (Stock = 1),
// pessimistic database locking and transaction boundaries ensure:
// 1. Exactly 1 sale succeeds.
// 2. All other concurrent sales fail with out-of-stock / insufficient stock errors.
// 3. Final inventory stock ends at exactly 0.0 (no negative stock or race condition).
func TestE2E_Concurrency_PessimisticLock_LastUnitRace(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Create a product with exactly 1 unit in stock
	prod := h.NewProduct("سوار ذهبي محدود (قطعة أخيرة)", 500000, 1.0)
	cust := h.NewCustomer("زبون السباق المتزامن", 0)

	const concurrencyLevel = 10
	var wg sync.WaitGroup
	wg.Add(concurrencyLevel)

	startGate := make(chan struct{})
	var successCount int64
	var failureCount int64

	// 2. Launch concurrent cashier goroutines
	for i := 0; i < concurrencyLevel; i++ {
		go func() {
			defer wg.Done()
			<-startGate // Align start time

			sale := buildSale(prod, cust, 1.0, "cash")
			err := h.SaleHandler.ProcessSale(sale)
			if err == nil {
				atomic.AddInt64(&successCount, 1)
			} else {
				atomic.AddInt64(&failureCount, 1)
			}
		}()
	}

	// Release all goroutines simultaneously
	close(startGate)
	wg.Wait()

	// 3. Assert exact race behavior
	if successCount != 1 {
		t.Fatalf("RACE CONDITION DETECTED: expected exactly 1 successful sale for last unit, got %d successes and %d failures", successCount, failureCount)
	}

	if failureCount != concurrencyLevel-1 {
		t.Errorf("expected %d failed sales, got %d", concurrencyLevel-1, failureCount)
	}

	// 4. Assert stock is exactly 0.0
	pFinal := h.MustReloadProduct(prod.ID)
	if pFinal.Stock != 0 {
		t.Fatalf("STOCK ANOMALY: expected final stock 0.0, got %v", pFinal.Stock)
	}
}
