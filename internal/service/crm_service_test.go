package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/logger"
	"testing"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupCRMTestDB(t *testing.T) (service.CRMService, *gorm.DB, func()) {
	logger.InitLogger(logger.INFO, false)
	db, cleanup := testutil.SetupDB(t,
		&domain.Customer{}, &domain.Supplier{}, &domain.Product{}, &domain.Sale{},
	)

	customerRepo := repository.NewCustomerRepository(db)
	supplierRepo := repository.NewSupplierRepository(db)
	productRepo := repository.NewProductRepository(db)

	crmService := service.NewCRMService(customerRepo, supplierRepo, productRepo)

	return crmService, db, cleanup
}

func TestCustomerLifecycle(t *testing.T) {
	s, db, cleanup := setupCRMTestDB(t)
	defer cleanup()

	// 1. Create customer with invalid name
	badCust := domain.Customer{Name: "A"}
	if err := s.SaveCustomer(badCust); err == nil {
		t.Error("Expected error for name shorter than 2 chars")
	}

	// 2. Create customer with initial debt (blocked)
	debtCust := domain.Customer{Name: "John Doe", Phone: "07701234567", Debt: 15000}
	if err := s.SaveCustomer(debtCust); err == nil {
		t.Error("Expected error when saving new customer with initial debt")
	}

	// 3. Create customer successfully
	cust := domain.Customer{Name: "John Doe", Phone: "07701234567"}
	if err := s.SaveCustomer(cust); err != nil {
		t.Fatalf("SaveCustomer failed: %v", err)
	}

	// Verify creation
	custs, _ := s.GetCustomers()
	if len(custs) != 1 {
		t.Fatalf("Expected 1 customer, got %d", len(custs))
	}
	john := custs[0]

	// 4. Test duplicate phone check
	dupCust := domain.Customer{Name: "Jane Doe", Phone: "07701234567"}
	if err := s.SaveCustomer(dupCust); err == nil {
		t.Error("Expected error for duplicate phone number")
	}

	// 5. Test DeleteCustomer with debt
	john.Debt = 5000
	db.Save(&john)

	err := s.DeleteCustomer(john.ID, false)
	if err == nil {
		t.Error("Expected error when deleting customer with debt without force")
	}

	err = s.DeleteCustomer(john.ID, true)
	if err != nil {
		t.Fatalf("DeleteCustomer with force failed: %v", err)
	}

	custs, _ = s.GetCustomers()
	if len(custs) != 0 {
		t.Errorf("Expected 0 customers after deletion, got %d", len(custs))
	}
}

func TestSupplierLifecycle(t *testing.T) {
	s, db, cleanup := setupCRMTestDB(t)
	defer cleanup()

	// 1. Create Supplier
	sup := domain.Supplier{
		Name:  "Test Supplier",
		Phone: "07801112233",
	}

	if err := s.SaveSupplier(sup); err != nil {
		t.Fatalf("SaveSupplier failed: %v", err)
	}

	sups, _ := s.GetSuppliers()
	if len(sups) != 1 {
		t.Fatalf("Expected 1 supplier, got %d", len(sups))
	}
	supplierID := sups[0].ID

	// 2. Link Product to Supplier
	product := domain.Product{
		ID:       uuid.New().String(),
		Name:     "Keyboard",
		Barcode:  "990011",
		Price:    10000,
		Supplier: "Test Supplier",
	}
	db.Create(&product)

	// 3. Delete Supplier without force
	err := s.DeleteSupplier(supplierID, false)
	if err == nil {
		t.Error("Expected error deleting supplier with products without force")
	}

	// 4. Delete Supplier with force
	err = s.DeleteSupplier(supplierID, true)
	if err != nil {
		t.Fatalf("DeleteSupplier with force failed: %v", err)
	}

	// Verify supplier deleted
	sups, _ = s.GetSuppliers()
	if len(sups) != 0 {
		t.Errorf("Expected 0 suppliers, got %d", len(sups))
	}

	// Verify product unlinked
	var p domain.Product
	db.First(&p, "id = ?", product.ID)
	if p.Supplier != "" {
		t.Errorf("Expected product supplier to be empty, got '%s'", p.Supplier)
	}
}

func TestSearchCustomers(t *testing.T) {
	s, db, cleanup := setupCRMTestDB(t)
	defer cleanup()

	// Create test customers
	db.Create(&domain.Customer{ID: "c1", Name: "Ali Ahmed", Phone: "07701112222"})
	db.Create(&domain.Customer{ID: "c2", Name: "Omar Ali", Phone: "07803334444"})
	db.Create(&domain.Customer{ID: "c3", Name: "Zainab", Phone: "07505556666"})

	// Search by name
	results, err := s.SearchCustomers("Ali")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(results) != 2 {
		t.Errorf("Expected 2 customers, got %d", len(results))
	}

	// Search by phone
	results, err = s.SearchCustomers("0780")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(results) != 1 {
		t.Errorf("Expected 1 customer, got %d", len(results))
	}

	// Search with no match
	results, err = s.SearchCustomers("Nonexistent")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(results) != 0 {
		t.Errorf("Expected 0 customers, got %d", len(results))
	}
}
