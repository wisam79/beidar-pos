package e2e

import (
	"sync"
	"testing"
	"time"
)

// Simulated database record for a product's stock
type MockProduct struct {
	mu    sync.Mutex
	Stock int
}

func (p *MockProduct) DecrementStock(qty int) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.Stock >= qty {
		// Simulate network/DB latency
		time.Sleep(1 * time.Millisecond)
		p.Stock -= qty
		return true
	}
	return false
}

func TestConcurrency_StockDepletion(t *testing.T) {
	// We want to test that 100 concurrent requests trying to buy 1 item
	// from a stock of 50 will result in exactly 50 successful sales.
	product := &MockProduct{Stock: 50}

	var wg sync.WaitGroup
	successes := 0
	var successMu sync.Mutex

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if product.DecrementStock(1) {
				successMu.Lock()
				successes++
				successMu.Unlock()
			}
		}()
	}
	wg.Wait()

	if successes != 50 {
		t.Errorf("Expected exactly 50 successes, got %d", successes)
	}
	if product.Stock != 0 {
		t.Errorf("Expected final stock to be 0, got %d", product.Stock)
	}
}

type MockAccount struct {
	mu      sync.Mutex
	Balance int64 // cents
}

func (a *MockAccount) Add(amount int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	time.Sleep(1 * time.Millisecond)
	a.Balance += amount
}

func (a *MockAccount) Subtract(amount int64) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	time.Sleep(1 * time.Millisecond)
	if a.Balance >= amount {
		a.Balance -= amount
		return true
	}
	return false
}

func TestConcurrency_CustomerDebtAdjustments(t *testing.T) {
	// A customer starts with 10000 cents (100.00) debt.
	// 50 concurrent payments of 100 cents (1.00) each.
	// 50 concurrent returns creating new debt of 200 cents (2.00) each.
	// Total: 10000 - 5000 + 10000 = 15000
	account := &MockAccount{Balance: 10000}

	var wg sync.WaitGroup

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			account.Subtract(100) // Paying off debt
		}()
	}

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			account.Add(200) // Adding new debt
		}()
	}

	wg.Wait()

	if account.Balance != 15000 {
		t.Errorf("Expected final debt balance 15000, got %d", account.Balance)
	}
}

func TestConcurrency_MultipleDiscountRaces(t *testing.T) {
	// A scenario where multiple cashiers apply discounts on the same global budget
	budget := &MockAccount{Balance: 5000} // $50 global discount limit
	var wg sync.WaitGroup
	appliedCount := 0
	var appliedMu sync.Mutex

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if budget.Subtract(100) { // Try to apply $1 discount
				appliedMu.Lock()
				appliedCount++
				appliedMu.Unlock()
			}
		}()
	}
	wg.Wait()

	if appliedCount != 50 {
		t.Errorf("Expected 50 discounts applied, got %d", appliedCount)
	}
	if budget.Balance != 0 {
		t.Errorf("Expected empty budget, got %d", budget.Balance)
	}
}

func TestConcurrency_ShiftSalesAccumulation(t *testing.T) {
	shiftTotal := &MockAccount{Balance: 0}
	var wg sync.WaitGroup

	// 200 sales happen concurrently
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func(val int64) {
			defer wg.Done()
			shiftTotal.Add(val)
		}(int64((i % 10) * 100)) // varying amounts
	}
	wg.Wait()

	// Sum of 20 iterations of (0+100+200+...+900) = 20 * 4500 = 90000
	if shiftTotal.Balance != 90000 {
		t.Errorf("Expected 90000 total shift sales, got %d", shiftTotal.Balance)
	}
}
