package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"os"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupPaymentTestDB(t *testing.T) (service.PaymentService, *gorm.DB, func()) {
	dbFileName := "test_payment_" + uuid.New().String()[:8] + ".db"
	os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	if err := db.AutoMigrate(
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Payment{},
		&domain.StockMovement{}, &domain.Shift{}, &domain.CashMovement{}, &domain.Staff{},
		&domain.AppPreferences{}, &domain.LoginAttempt{}, &domain.Supplier{}, &domain.Category{},
		&domain.ParkedSale{},
	); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}

	db.Create(&domain.AppPreferences{ID: 1, StoreName: "Test Store", Currency: "IQD"})

	prefRepo := repository.NewPreferencesRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	_ = repository.NewProductRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)

	paymentService := service.NewPaymentService(paymentRepo, customerRepo, saleRepo, shiftRepo, prefRepo)

	return paymentService, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		os.Remove(dbFileName)
	}
}

func TestCalculateInstallmentPlan(t *testing.T) {
	s, _, cleanup := setupPaymentTestDB(t)
	defer cleanup()

	plan, err := s.CalculateInstallmentPlan(domain.NewAmount(1000), domain.NewAmount(200), 3)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan failed: %v", err)
	}

	if plan.TotalAmount.Cents() != 100000 {
		t.Errorf("Expected TotalAmount 1000, got %d", plan.TotalAmount.Cents())
	}
	if plan.DownPayment.Cents() != 20000 {
		t.Errorf("Expected DownPayment 200, got %d", plan.DownPayment.Cents())
	}
	if plan.Months != 3 {
		t.Errorf("Expected 3 months, got %d", plan.Months)
	}
	if len(plan.Schedule) != 3 {
		t.Errorf("Expected schedule length 3, got %d", len(plan.Schedule))
	}

	// 1000 - 200 = 800. 800/3 = 266.67
	// Base amount rounded to 250 = 250.
	// First 2 installments should be 250, last should be 300.
	if plan.Schedule[0].Amount.Cents() != 25000 {
		t.Errorf("Expected installment 1 amount 250, got %d", plan.Schedule[0].Amount.Cents())
	}
	if plan.Schedule[1].Amount.Cents() != 25000 {
		t.Errorf("Expected installment 2 amount 250, got %d", plan.Schedule[1].Amount.Cents())
	}
	if plan.Schedule[2].Amount.Cents() != 30000 {
		t.Errorf("Expected installment 3 amount 300, got %d", plan.Schedule[2].Amount.Cents())
	}
}

func TestCreatePayment(t *testing.T) {
	s, db, cleanup := setupPaymentTestDB(t)
	defer cleanup()

	customer := &domain.Customer{
		ID:    uuid.New().String(),
		Name:  "Test Customer",
		Phone: "0770123456",
		Debt:  domain.NewAmount(500),
	}
	db.Create(customer)

	// Test payment creation
	pay := domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(200),
		Method:     "cash",
		Note:       "Regular Payment",
	}

	created, err := s.CreatePayment(pay)
	if err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}

	if created.Amount.Cents() != 20000 {
		t.Errorf("Expected payment amount 200, got %d", created.Amount.Cents())
	}

	// Verify customer debt decreased
	var updatedCustomer domain.Customer
	db.First(&updatedCustomer, "id = ?", customer.ID)
	if updatedCustomer.Debt.Cents() != 30000 {
		t.Errorf("Expected updated debt 300, got %d", updatedCustomer.Debt.Cents())
	}

	// Verify payment list by customer
	payments, err := s.GetPaymentsByCustomer(customer.ID)
	if err != nil {
		t.Fatalf("GetPaymentsByCustomer failed: %v", err)
	}
	if len(payments) != 1 {
		t.Errorf("Expected 1 payment, got %d", len(payments))
	}
}

func TestCreatePaymentOverpay(t *testing.T) {
	s, db, cleanup := setupPaymentTestDB(t)
	defer cleanup()

	customer := &domain.Customer{
		ID:    uuid.New().String(),
		Name:  "Test Customer",
		Phone: "0770123456",
		Debt:  domain.NewAmount(100),
	}
	db.Create(customer)

	// Test payment exceeding debt without ack (fails)
	pay := domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(200),
		Method:     "cash",
	}
	_, err := s.CreatePayment(pay)
	if err == nil {
		t.Fatal("Expected error when paying more than debt without ack")
	}

	// Test payment exceeding debt with ack (succeeds)
	pay.Note = "[OVERPAY_OK]"
	_, err = s.CreatePayment(pay)
	if err != nil {
		t.Fatalf("CreatePayment with [OVERPAY_OK] failed: %v", err)
	}
}

func TestDeletePayment(t *testing.T) {
	s, db, cleanup := setupPaymentTestDB(t)
	defer cleanup()

	customer := &domain.Customer{
		ID:    uuid.New().String(),
		Name:  "Test Customer",
		Phone: "0770123456",
		Debt:  domain.NewAmount(500),
	}
	db.Create(customer)

	pay := domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(200),
		Method:     "cash",
	}
	created, err := s.CreatePayment(pay)
	if err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}

	// Re-verify debt is 300
	var c domain.Customer
	db.First(&c, "id = ?", customer.ID)
	if c.Debt.Cents() != 30000 {
		t.Fatalf("Unexpected debt before delete: %d", c.Debt.Cents())
	}

	// Delete payment
	err = s.DeletePayment(created.ID)
	if err != nil {
		t.Fatalf("DeletePayment failed: %v", err)
	}

	// Debt should revert to 500
	db.First(&c, "id = ?", customer.ID)
	if c.Debt.Cents() != 50000 {
		t.Errorf("Expected reverted debt 500, got %d", c.Debt.Cents())
	}
}

func TestPayInstallments(t *testing.T) {
	s, db, cleanup := setupPaymentTestDB(t)
	defer cleanup()

	customer := &domain.Customer{
		ID:              uuid.New().String(),
		Name:            "Test Customer",
		Phone:           "0770123456",
		InstallmentDebt: domain.NewAmount(800),
	}
	db.Create(customer)

	plan, _ := s.CalculateInstallmentPlan(domain.NewAmount(1000), domain.NewAmount(200), 3)

	sale := &domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      customer.ID,
		CustomerName:    customer.Name,
		Total:           domain.NewAmount(1000),
		PaymentMethod:   "installment",
		Status:          "pending",
		InstallmentPlan: plan,
		Date:            time.Now().Format("2006-01-02"),
		Timestamp:       time.Now().UnixMilli(),
	}
	db.Create(sale)

	// Pay first installment (250)
	err := s.PayInstallment(sale.ID, 0, domain.NewAmount(250), "cash")
	if err != nil {
		t.Fatalf("PayInstallment failed: %v", err)
	}

	// Check installment summary
	tot, paid, rem, err := s.GetInstallmentSummary(sale.ID)
	if err != nil {
		t.Fatalf("GetInstallmentSummary failed: %v", err)
	}
	if tot != 3 || paid != 1 || rem.Cents() != 55000 {
		t.Errorf("Expected 3 tot, 1 paid, 550 rem; got %d, %d, %d", tot, paid, rem.Cents())
	}

	// Try paying wrong amount
	err = s.PayInstallment(sale.ID, 1, domain.NewAmount(100), "cash")
	if err == nil {
		t.Fatal("Expected error when paying wrong installment amount")
	}

	// Pay remaining installments
	err = s.PayInstallment(sale.ID, 1, domain.NewAmount(250), "cash")
	if err != nil {
		t.Fatalf("PayInstallment 2 failed: %v", err)
	}
	err = s.PayInstallment(sale.ID, 2, domain.NewAmount(300), "cash")
	if err != nil {
		t.Fatalf("PayInstallment 3 failed: %v", err)
	}

	// Verify sale status is now paid
	var updatedSale domain.Sale
	db.First(&updatedSale, "id = ?", sale.ID)
	if updatedSale.Status != "paid" {
		t.Errorf("Expected sale status 'paid', got '%s'", updatedSale.Status)
	}
}

func TestPaymentService_Getters(t *testing.T) {
	s, db, cleanup := setupPaymentTestDB(t)
	defer cleanup()

	customerID := uuid.New().String()
	saleID := uuid.New().String()

	// 1. GetPaymentsBySale (expect empty/none first)
	payments, err := s.GetPaymentsBySale(saleID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	if len(payments) != 0 {
		t.Errorf("Expected 0 payments, got %d", len(payments))
	}

	// Create a payment associated with saleID
	p := domain.Payment{
		CustomerID: customerID,
		SaleID:     saleID,
		Amount:     domain.NewAmount(100),
		Method:     "cash",
	}
	db.Create(&p)

	// Now check GetPaymentsBySale
	payments, err = s.GetPaymentsBySale(saleID)
	if err != nil {
		t.Fatalf("GetPaymentsBySale failed: %v", err)
	}
	if len(payments) != 1 {
		t.Errorf("Expected 1 payment, got %d", len(payments))
	}

	// 2. GetCustomerInstallments
	// Create an installment sale
	sale := domain.Sale{
		ID:            saleID,
		CustomerID:    customerID,
		PaymentMethod: "installment",
		Total:         domain.NewAmount(500),
	}
	db.Create(&sale)

	sales, err := s.GetCustomerInstallments(customerID)
	if err != nil {
		t.Fatalf("GetCustomerInstallments failed: %v", err)
	}
	if len(sales) != 1 {
		t.Errorf("Expected 1 installment sale, got %d", len(sales))
	}

	// 3. DeletePayment with non-existent ID
	err = s.DeletePayment(9999)
	if err == nil {
		t.Error("Expected error when deleting non-existent payment")
	}
}

