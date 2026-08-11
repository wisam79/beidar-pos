package service_test

import (
	"errors"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/logger"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupCRMEdgeTestDB(t *testing.T) (domain.CRMService, *gorm.DB, func()) {
	t.Helper()
	logger.InitLogger(logger.INFO, false)
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	customerRepo := repository.NewCustomerRepository(db)
	supplierRepo := repository.NewSupplierRepository(db)
	productRepo := repository.NewProductRepository(db)

	crmService := service.NewCRMService(customerRepo, supplierRepo, productRepo)

	return crmService, db, cleanup
}

func TestEdge_SaveCustomer_MassAssignment_DebtProtection(t *testing.T) {
	s, db, cleanup := setupCRMEdgeTestDB(t)
	defer cleanup()

	// 1. Seed customer directly with financial fields
	custID := uuid.New().String()
	originalCustomer := domain.Customer{
		ID:              custID,
		Name:            "Original Customer",
		Phone:           "07701122334",
		Debt:            domain.NewAmount(75000),
		InstallmentDebt: domain.NewAmount(150000),
		TotalPurchases:  domain.NewAmount(500000),
		Points:          350,
		Notes:           "VIP Customer",
	}
	if err := db.Create(&originalCustomer).Error; err != nil {
		t.Fatalf("Failed to create original customer: %v", err)
	}

	// 2. Attempt to update customer via SaveCustomer passing 0 for Debt, InstallmentDebt, TotalPurchases, Points
	updatePayload := domain.Customer{
		ID:              custID,
		Name:            "Updated Name",
		Phone:           "07709988776",
		Notes:           "Updated Notes",
		Debt:            domain.Zero(),
		InstallmentDebt: domain.Zero(),
		TotalPurchases:  domain.Zero(),
		Points:          0,
	}
	if err := s.SaveCustomer(updatePayload); err != nil {
		t.Fatalf("SaveCustomer update failed: %v", err)
	}

	// 3. Reload customer from DB and verify financial fields were protected against mass-assignment
	var reloaded domain.Customer
	if err := db.First(&reloaded, "id = ?", custID).Error; err != nil {
		t.Fatalf("Failed to reload customer: %v", err)
	}

	// Safe fields must be updated
	if reloaded.Name != "Updated Name" {
		t.Errorf("Expected Name 'Updated Name', got %q", reloaded.Name)
	}
	if reloaded.Phone != "07709988776" {
		t.Errorf("Expected Phone '07709988776', got %q", reloaded.Phone)
	}
	if reloaded.Notes != "Updated Notes" {
		t.Errorf("Expected Notes 'Updated Notes', got %q", reloaded.Notes)
	}

	// Sensitive financial & loyalty fields MUST NOT be overwritten
	if reloaded.Debt != domain.NewAmount(75000) {
		t.Errorf("Debt was overwritten! Expected 75000, got %s", reloaded.Debt.String())
	}
	if reloaded.InstallmentDebt != domain.NewAmount(150000) {
		t.Errorf("InstallmentDebt was overwritten! Expected 150000, got %s", reloaded.InstallmentDebt.String())
	}
	if reloaded.TotalPurchases != domain.NewAmount(500000) {
		t.Errorf("TotalPurchases was overwritten! Expected 500000, got %s", reloaded.TotalPurchases.String())
	}
	if reloaded.Points != 350 {
		t.Errorf("Points were overwritten! Expected 350, got %d", reloaded.Points)
	}
}

func TestEdge_DeleteCustomer_WithActiveInstallments_Rejected(t *testing.T) {
	s, db, cleanup := setupCRMEdgeTestDB(t)
	defer cleanup()

	custID := uuid.New().String()
	cust := domain.Customer{
		ID:    custID,
		Name:  "Installment Customer",
		Phone: "07805544332",
		Debt:  domain.NewAmount(25000),
	}
	if err := db.Create(&cust).Error; err != nil {
		t.Fatalf("Failed to create customer: %v", err)
	}

	// Create an active installment sale for this customer
	saleID := "sale_inst_" + uuid.New().String()[:8]
	sale := domain.Sale{
		ID:            saleID,
		CustomerID:    custID,
		CustomerName:  cust.Name,
		PaymentMethod: "installment",
		Status:        "pending",
		Total:         domain.NewAmount(100000),
	}
	if err := db.Create(&sale).Error; err != nil {
		t.Fatalf("Failed to create installment sale: %v", err)
	}

	// 1. Delete customer without force -> rejected due to active installments
	err := s.DeleteCustomer(custID, false)
	if err == nil {
		t.Fatal("Expected DeleteCustomer to fail when customer has active installments")
	}

	var appErr *pkgerrors.AppError
	if errors.As(err, &appErr) {
		if appErr.Code != "CUSTOMER_HAS_ACTIVE_INSTALLMENTS" {
			t.Errorf("Expected AppError code 'CUSTOMER_HAS_ACTIVE_INSTALLMENTS', got %q", appErr.Code)
		}
	} else {
		t.Errorf("Expected *pkgerrors.AppError, got %T: %v", err, err)
	}

	// 2. Delete customer with force -> still rejected because active installments cannot be bypassed
	err = s.DeleteCustomer(custID, true)
	if err == nil {
		t.Fatal("Expected DeleteCustomer with force=true to still fail when active installments exist")
	}
	if errors.As(err, &appErr) {
		if appErr.Code != "CUSTOMER_HAS_ACTIVE_INSTALLMENTS" {
			t.Errorf("Expected AppError code 'CUSTOMER_HAS_ACTIVE_INSTALLMENTS', got %q", appErr.Code)
		}
	}

	// 3. Mark the installment sale as "paid"
	if err := db.Model(&domain.Sale{}).Where("id = ?", saleID).Update("status", "paid").Error; err != nil {
		t.Fatalf("Failed to update sale status: %v", err)
	}

	// 4. Deleting without force now fails on remaining general debt
	err = s.DeleteCustomer(custID, false)
	if err == nil {
		t.Fatal("Expected DeleteCustomer without force to fail due to remaining debt")
	}
	if errors.As(err, &appErr) {
		if appErr.Code != "CUSTOMER_HAS_DEBT" {
			t.Errorf("Expected AppError code 'CUSTOMER_HAS_DEBT', got %q", appErr.Code)
		}
	}

	// 5. Deleting with force=true now succeeds
	err = s.DeleteCustomer(custID, true)
	if err != nil {
		t.Fatalf("DeleteCustomer with force=true failed: %v", err)
	}

	// Verify customer deleted
	var remaining domain.Customer
	err = db.First(&remaining, "id = ?", custID).Error
	if err == nil {
		t.Fatal("Expected customer to be deleted from DB")
	}
}
