package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestExpenseRepository(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	repo := NewExpenseRepository(db)

	t.Run("CreateAndGetExpenses", func(t *testing.T) {
		e1 := &domain.Expense{
			ID:       "exp-1",
			Amount:   15000,
			Category: "Office",
			Title:    "Pens and notebooks",
			Date:     time.Now().Format("2006-01-02 15:04:05"),
		}
		e2 := &domain.Expense{
			ID:       "exp-2",
			Amount:   25000,
			Category: "Rent",
			Title:    "Monthly rent",
			Date:     time.Now().Add(time.Hour).Format("2006-01-02 15:04:05"),
		}

		if err := repo.CreateExpense(e1); err != nil {
			t.Fatalf("Failed to create expense 1: %v", err)
		}
		if err := repo.CreateExpense(e2); err != nil {
			t.Fatalf("Failed to create expense 2: %v", err)
		}

		expenses, err := repo.GetExpenses("")
		if err != nil {
			t.Fatalf("GetExpenses failed: %v", err)
		}
		if len(expenses) != 2 {
			t.Errorf("Expected 2 expenses, got %d", len(expenses))
		}

		got, err := repo.GetExpenseByID("exp-1")
		if err != nil {
			t.Fatalf("GetExpenseByID failed: %v", err)
		}
		if got.Category != "Office" {
			t.Errorf("Expected category 'Office', got %q", got.Category)
		}
	})

	t.Run("UpdateAndDeleteExpense", func(t *testing.T) {
		exp, err := repo.GetExpenseByID("exp-2")
		if err != nil {
			t.Fatalf("GetExpenseByID failed: %v", err)
		}

		exp.Amount = 28000
		if err := repo.UpdateExpense(exp); err != nil {
			t.Fatalf("UpdateExpense failed: %v", err)
		}

		updated, _ := repo.GetExpenseByID("exp-2")
		if int64(updated.Amount) != 28000 {
			t.Errorf("Expected updated amount 28000, got %v", updated.Amount)
		}

		if err := repo.DeleteExpense("exp-2"); err != nil {
			t.Fatalf("DeleteExpense failed: %v", err)
		}

		deleted, err := repo.GetExpenseByID("exp-2")
		if err == nil {
			t.Errorf("Expected error fetching deleted expense, got %v", deleted)
		}
	})

	t.Run("CategoryOperations", func(t *testing.T) {
		c1 := &domain.Category{
			ID:   "cat-1",
			Name: "Drinks",
		}
		c2 := &domain.Category{
			ID:   "cat-2",
			Name: "Snacks",
		}

		if err := repo.CreateCategory(c1); err != nil {
			t.Fatalf("CreateCategory failed: %v", err)
		}
		if err := repo.CreateCategory(c2); err != nil {
			t.Fatalf("CreateCategory failed: %v", err)
		}

		cats, err := repo.GetCategories()
		if err != nil {
			t.Fatalf("GetCategories failed: %v", err)
		}
		if len(cats) != 2 {
			t.Errorf("Expected 2 categories, got %d", len(cats))
		}

		gotByID, err := repo.GetCategoryByID("cat-1")
		if err != nil {
			t.Fatalf("GetCategoryByID failed: %v", err)
		}
		if gotByID.Name != "Drinks" {
			t.Errorf("Expected Name 'Drinks', got %q", gotByID.Name)
		}

		gotByName, err := repo.GetCategoryByName("Snacks")
		if err != nil {
			t.Fatalf("GetCategoryByName failed: %v", err)
		}
		if gotByName.ID != "cat-2" {
			t.Errorf("Expected ID 'cat-2', got %q", gotByName.ID)
		}

		// Update category
		gotByName.Name = "Sweets"
		if err := repo.UpdateCategory(gotByName); err != nil {
			t.Fatalf("UpdateCategory failed: %v", err)
		}

		updated, _ := repo.GetCategoryByID("cat-2")
		if updated.Name != "Sweets" {
			t.Errorf("Expected updated name 'Sweets', got %q", updated.Name)
		}

		// Delete category
		if err := repo.DeleteCategory("cat-2"); err != nil {
			t.Fatalf("DeleteCategory failed: %v", err)
		}
		deleted, err := repo.GetCategoryByID("cat-2")
		if err == nil {
			t.Errorf("Expected error fetching deleted category, got %v", deleted)
		}
	})

	t.Run("ProductCategoryCountsAndUpdates", func(t *testing.T) {
		// Create a product with category "OldCat"
		p := &domain.Product{
			ID:       "prod-1",
			Name:     "Test Product",
			Category: "OldCat",
			Price:    1000,
			Cost:     700,
		}
		if err := db.Create(p).Error; err != nil {
			t.Fatalf("Failed to create seed product: %v", err)
		}

		count, err := repo.CountProductsInCategory("OldCat")
		if err != nil {
			t.Fatalf("CountProductsInCategory failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1 product in category, got %d", count)
		}

		err = repo.UpdateProductCategory("OldCat", "NewCat")
		if err != nil {
			t.Fatalf("UpdateProductCategory failed: %v", err)
		}

		oldCount, _ := repo.CountProductsInCategory("OldCat")
		if oldCount != 0 {
			t.Errorf("Expected 0 products in OldCat, got %d", oldCount)
		}

		newCount, _ := repo.CountProductsInCategory("NewCat")
		if newCount != 1 {
			t.Errorf("Expected 1 product in NewCat, got %d", newCount)
		}
	})

	t.Run("TransactionsAndWithTx", func(t *testing.T) {
		err := repo.Transaction(func(tx domain.Tx) error {
			txRepo := repo.WithTx(tx)
			e := &domain.Expense{
				ID:       "exp-tx",
				Amount:   5000,
				Category: "Tax",
				Date:     time.Now().Format("2006-01-02 15:04:05"),
			}
			return txRepo.CreateExpense(e)
		})
		if err != nil {
			t.Fatalf("Transaction failed: %v", err)
		}

		got, err := repo.GetExpenseByID("exp-tx")
		if err != nil {
			t.Fatalf("GetExpenseByID for tx expense failed: %v", err)
		}
		if int64(got.Amount) != 5000 {
			t.Errorf("Expected Amount 5000, got %v", got.Amount)
		}
	})
}
