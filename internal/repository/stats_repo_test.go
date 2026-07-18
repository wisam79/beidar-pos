package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestStatsRepository(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewStatsRepository(db)

	todayStr := time.Now().Format("2006-01-02")

	// Set up seed data
	t.Run("SeedDataSetup", func(t *testing.T) {
		// 1. Create products
		p1 := &domain.Product{
			ID:       "p1",
			Name:     "Product A",
			Barcode:  "barcode-a",
			Price:    1000,
			Cost:     600,
			Stock:    3, // low stock
			MinStock: 5,
		}
		p2 := &domain.Product{
			ID:       "p2",
			Name:     "Product B",
			Barcode:  "barcode-b",
			Price:    2000,
			Cost:     1200,
			Stock:    10,
			MinStock: 5,
		}
		if err := db.Create(p1).Error; err != nil {
			t.Fatalf("Failed to seed product A: %v", err)
		}
		if err := db.Create(p2).Error; err != nil {
			t.Fatalf("Failed to seed product B: %v", err)
		}

		// 2. Create sales
		sale1 := &domain.Sale{
			ID:           "sale-1",
			Total:        5000,
			Date:         todayStr,
			CustomerName: "Customer Alice",
			Status:       "completed",
			Timestamp:    time.Now().Add(-time.Hour).Unix(),
			Items: []domain.SaleItem{
				{
					ProductID: "p1",
					Name:      "Product A",
					Quantity:  3,
					Price:     1000,
					Cost:      600,
				},
				{
					ProductID: "p2",
					Name:      "Product B",
					Quantity:  1,
					Price:     2000,
					Cost:      1200,
				},
			},
		}
		sale2 := &domain.Sale{
			ID:           "sale-2",
			Total:        4000,
			Date:         todayStr,
			CustomerName: "Customer Bob",
			Status:       "completed",
			Timestamp:    time.Now().Unix(),
			Items: []domain.SaleItem{
				{
					ProductID: "p2",
					Name:      "Product B",
					Quantity:  2,
					Price:     2000,
					Cost:      1200,
				},
			},
		}
		if err := db.Create(sale1).Error; err != nil {
			t.Fatalf("Failed to seed sale 1: %v", err)
		}
		if err := db.Create(sale2).Error; err != nil {
			t.Fatalf("Failed to seed sale 2: %v", err)
		}

		// 3. Create expenses
		exp := &domain.Expense{
			ID:       "exp-1",
			Amount:   3000,
			Category: "Utilities",
			Date:     time.Now().Format("2006-01-02 15:04:05"),
		}
		if err := db.Create(exp).Error; err != nil {
			t.Fatalf("Failed to seed expense: %v", err)
		}
	})

	t.Run("GetBasicStats", func(t *testing.T) {
		totalRev, totalOrders, dailyRev, dailyOrders, totalProds, lowStock, err := repo.GetBasicStats(todayStr)
		if err != nil {
			t.Fatalf("GetBasicStats failed: %v", err)
		}

		if int64(totalRev) != 9000 {
			t.Errorf("Expected total revenue 9000, got %v", totalRev)
		}
		if totalOrders != 2 {
			t.Errorf("Expected total orders 2, got %d", totalOrders)
		}
		if int64(dailyRev) != 9000 {
			t.Errorf("Expected daily revenue 9000, got %v", dailyRev)
		}
		if dailyOrders != 2 {
			t.Errorf("Expected daily orders 2, got %d", dailyOrders)
		}
		if totalProds != 2 {
			t.Errorf("Expected 2 products, got %d", totalProds)
		}
		if lowStock != 1 {
			t.Errorf("Expected 1 low stock product, got %d", lowStock)
		}
	})

	t.Run("GetRecentSales", func(t *testing.T) {
		sales, err := repo.GetRecentSales(10)
		if err != nil {
			t.Fatalf("GetRecentSales failed: %v", err)
		}
		if len(sales) != 2 {
			t.Errorf("Expected 2 recent sales, got %d", len(sales))
		}
		if sales[0].ID != "sale-2" { // desc ordering
			t.Errorf("Expected latest sale first (sale-2), got %q", sales[0].ID)
		}
	})

	t.Run("GetTopSellingProducts", func(t *testing.T) {
		tops, err := repo.GetTopSellingProducts(5)
		if err != nil {
			t.Fatalf("GetTopSellingProducts failed: %v", err)
		}
		if len(tops) != 2 {
			t.Fatalf("Expected 2 top selling products, got %d", len(tops))
		}
		// Product B should be first: 1 (sale-1) + 2 (sale-2) = 3 quantity
		if tops[0].Label != "Product B" {
			t.Errorf("Expected top product 'Product B', got %q", tops[0].Label)
		}
		if tops[0].Value != 3 {
			t.Errorf("Expected Product B qty 3, got %d", tops[0].Value)
		}
	})

	t.Run("GetProfitAndExpenses", func(t *testing.T) {
		cogs, expenses, breakdown, err := repo.GetProfitAndExpenses()
		if err != nil {
			t.Fatalf("GetProfitAndExpenses failed: %v", err)
		}

		// COGS: 3 * 600 (Prod A) + 3 * 1200 (Prod B) = 1800 + 3600 = 5400
		if int64(cogs) != 5400 {
			t.Errorf("Expected COGS 5400, got %v", cogs)
		}
		if int64(expenses) != 3000 {
			t.Errorf("Expected expenses 3000, got %v", expenses)
		}
		if len(breakdown) != 1 || breakdown[0].Label != "Utilities" || int64(breakdown[0].Value) != 3000 {
			t.Errorf("Unexpected expense breakdown: %v", breakdown)
		}
	})

	t.Run("GetTopCustomers", func(t *testing.T) {
		custs, err := repo.GetTopCustomers(5)
		if err != nil {
			t.Fatalf("GetTopCustomers failed: %v", err)
		}
		if len(custs) != 2 {
			t.Fatalf("Expected 2 customers, got %d", len(custs))
		}
		if custs[0].Name != "Customer Alice" { // Alice spent 5000, Bob 4000
			t.Errorf("Expected top customer 'Customer Alice', got %q", custs[0].Name)
		}
	})

	t.Run("GetChartData", func(t *testing.T) {
		data, err := repo.GetChartData("2020-01-01", "%Y-%m-%d")
		if err != nil {
			t.Fatalf("GetChartData failed: %v", err)
		}
		if len(data) != 1 {
			t.Fatalf("Expected 1 chart data point, got %d", len(data))
		}
		if int64(data[0].Total) != 9000 {
			t.Errorf("Expected 9000 in chart data, got %v", data[0].Total)
		}
	})

	t.Run("GetMonthStats", func(t *testing.T) {
		rev, orders, exp, cogs, err := repo.GetMonthStats("2020-01-01", "2030-12-31")
		if err != nil {
			t.Fatalf("GetMonthStats failed: %v", err)
		}

		if int64(rev) != 9000 {
			t.Errorf("Expected revenue 9000, got %v", rev)
		}
		if orders != 2 {
			t.Errorf("Expected orders 2, got %d", orders)
		}
		if int64(exp) != 3000 {
			t.Errorf("Expected expenses 3000, got %v", exp)
		}
		if int64(cogs) != 5400 {
			t.Errorf("Expected cogs 5400, got %v", cogs)
		}
	})
}
