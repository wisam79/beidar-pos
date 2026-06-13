package service_test

import (
	"math"
	"os"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func floatEq(a, b float64) bool {
	return math.Abs(a-b) < 0.01
}

func amountEq(a, b domain.Amount) bool {
	return a.Sub(b).Abs().Cents() <= 1
}

func setupTestDB(t *testing.T) (service.SaleService, service.PaymentService, *gorm.DB, func()) {
	dbFileName := "test_" + uuid.New().String()[:8] + ".db"
	os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	db.AutoMigrate(
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Payment{},
		&domain.StockMovement{}, &domain.Shift{}, &domain.CashMovement{}, &domain.Staff{},
		&domain.AppPreferences{}, &domain.LoginAttempt{}, &domain.Supplier{}, &domain.Category{},
		&domain.ParkedSale{},
	)

	db.Create(&domain.AppPreferences{ID: 1, StoreName: "Test Store", Currency: "IQD"})

	// Setup Clean Architecture instances
	prefRepo := repository.NewPreferencesRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	productRepo := repository.NewProductRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)

	productService := service.NewProductService(productRepo)
	saleService := service.NewSaleService(saleRepo, productRepo, customerRepo, paymentRepo, shiftRepo, prefRepo, productService)
	paymentService := service.NewPaymentService(paymentRepo, customerRepo, saleRepo, shiftRepo, prefRepo)

	return saleService, paymentService, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		os.Remove(dbFileName)
	}
}

func createTestProduct(t *testing.T, db *gorm.DB, name string, price float64, stock float64) *domain.Product {
	p := &domain.Product{
		ID:    uuid.New().String(),
		Name:  name,
		Price: domain.NewAmount(price),
		Cost:  domain.NewAmount(price * 0.7),
		Stock: stock,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("Failed to create test product: %v", err)
	}
	return p
}

func createTestCustomer(t *testing.T, db *gorm.DB, name string, initialDebt float64) *domain.Customer {
	c := &domain.Customer{
		ID:    uuid.New().String(),
		Name:  name,
		Phone: uuid.New().String()[:10],
		Debt:  domain.NewAmount(initialDebt),
	}
	if err := db.Create(c).Error; err != nil {
		t.Fatalf("Failed to create test customer: %v", err)
	}
	return c
}

func refreshCustomer(t *testing.T, db *gorm.DB, id string) *domain.Customer {
	var c domain.Customer
	if err := db.First(&c, "id = ?", id).Error; err != nil {
		t.Fatalf("Failed to refresh customer: %v", err)
	}
	return &c
}

func TestCashSale_NoDebtChange(t *testing.T) {
	saleService, _, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Cash Customer", 0)
	product := createTestProduct(t, db, "Test Item", 100, 10)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Total:         domain.NewAmount(100),
		Subtotal:      domain.NewAmount(100),
		PaymentMethod: "cash",
		Status:        "completed",
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(100),
			Total:     domain.NewAmount(100),
		}},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := refreshCustomer(t, db, customer.ID)
	if c.Debt != domain.Zero() {
		t.Errorf("Cash sale should not create debt. Got %s, want 0", c.Debt.String())
	}
}

func TestCreditSale_DebtAdded(t *testing.T) {
	saleService, _, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Credit Customer", 50)
	product := createTestProduct(t, db, "Credit Item", 100, 10)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Total:         domain.NewAmount(100),
		Subtotal:      domain.NewAmount(100),
		PaymentMethod: "credit",
		Status:        "pending",
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(100),
			Total:     domain.NewAmount(100),
		}},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := refreshCustomer(t, db, customer.ID)
	expectedDebt := domain.NewAmount(150) // 50 + 100
	if !amountEq(c.Debt, expectedDebt) {
		t.Errorf("Credit sale debt wrong. Got %s, want %s", c.Debt.String(), expectedDebt.String())
	}
	if c.InstallmentDebt != domain.Zero() {
		t.Errorf("Credit sale should not affect installment debt. Got %s", c.InstallmentDebt.String())
	}
}

func TestInstallmentSale_SeparatedDebt(t *testing.T) {
	saleService, paymentService, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Installment Customer", 100000)
	product := createTestProduct(t, db, "Installment Item", 300000, 10)

	plan, err := paymentService.CalculateInstallmentPlan(domain.NewAmount(300000), domain.NewAmount(50000), 3)
	if err != nil {
		t.Fatalf("CalculatePlan failed: %v", err)
	}

	sale := domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      customer.ID,
		CustomerName:    customer.Name,
		Date:            time.Now().Format("2006-01-02"),
		Timestamp:       time.Now().UnixMilli(),
		Total:           domain.NewAmount(300000),
		Subtotal:        domain.NewAmount(300000),
		PaymentMethod:   "installment",
		Status:          "pending",
		InstallmentPlan: plan,
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(300000),
			Total:     domain.NewAmount(300000),
		}},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := refreshCustomer(t, db, customer.ID)
	expectedDebt := domain.NewAmount(100000)     // regular debt unchanged
	expectedInstDebt := domain.NewAmount(250000) // total - downpayment (300k - 50k)

	if !amountEq(c.Debt, expectedDebt) {
		t.Errorf("Regular debt changed. Got %s, want %s", c.Debt.String(), expectedDebt.String())
	}
	if !amountEq(c.InstallmentDebt, expectedInstDebt) {
		t.Errorf("InstallmentDebt wrong. Got %s, want %s", c.InstallmentDebt.String(), expectedInstDebt.String())
	}
}

func TestPayment_ReducesRegularDebt(t *testing.T) {
	_, paymentService, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Payment Customer", 50000)
	customer.InstallmentDebt = domain.NewAmount(100000)
	db.Save(customer)

	payment := domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(20000),
		Method:     "cash",
		Note:       "Regular Payment",
	}

	_, err := paymentService.CreatePayment(payment)
	if err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}

	c := refreshCustomer(t, db, customer.ID)
	expectedDebt := domain.NewAmount(30000) // 50k - 20k
	if !amountEq(c.Debt, expectedDebt) {
		t.Errorf("Debt wrong. Got %s, want %s", c.Debt.String(), expectedDebt.String())
	}
	if !amountEq(c.InstallmentDebt, domain.NewAmount(100000)) {
		t.Errorf("InstallmentDebt changed. Got %s", c.InstallmentDebt.String())
	}
}

func TestPayInstallment_ReducesInstallmentDebt(t *testing.T) {
	saleService, paymentService, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Installment Pay Customer", 50000)
	product := createTestProduct(t, db, "Installment Item", 300000, 10)

	plan, _ := paymentService.CalculateInstallmentPlan(domain.NewAmount(300000), domain.Zero(), 3)

	sale := domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      customer.ID,
		CustomerName:    customer.Name,
		Date:            time.Now().Format("2006-01-02"),
		Timestamp:       time.Now().UnixMilli(),
		Total:           domain.NewAmount(300000),
		Subtotal:        domain.NewAmount(300000),
		PaymentMethod:   "installment",
		Status:          "pending",
		InstallmentPlan: plan,
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  1,
			Price:     domain.NewAmount(300000),
			Total:     domain.NewAmount(300000),
		}},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Pay first installment (100,000)
	err := paymentService.PayInstallment(sale.ID, 0, domain.NewAmount(100000), "cash")
	if err != nil {
		t.Fatalf("PayInstallment failed: %v", err)
	}

	c := refreshCustomer(t, db, customer.ID)
	expectedInstDebt := domain.NewAmount(200000) // 300k - 100k
	if !amountEq(c.InstallmentDebt, expectedInstDebt) {
		t.Errorf("InstallmentDebt wrong. Got %s, want %s", c.InstallmentDebt.String(), expectedInstDebt.String())
	}
	if !amountEq(c.Debt, domain.NewAmount(50000)) {
		t.Errorf("Regular debt changed. Got %s", c.Debt.String())
	}
}

func TestReturnSale_ReversesDebtAndStock(t *testing.T) {
	saleService, _, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Return Customer", 0)
	product := createTestProduct(t, db, "Item", 5000, 10)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Total:         domain.NewAmount(10000),
		Subtotal:      domain.NewAmount(10000),
		PaymentMethod: "credit",
		Status:        "pending",
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  2,
			Price:     domain.NewAmount(5000),
			Total:     domain.NewAmount(10000),
		}},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Return
	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	c := refreshCustomer(t, db, customer.ID)
	if c.Debt != domain.Zero() {
		t.Errorf("Debt not reversed. Got %s, want 0", c.Debt.String())
	}

	var p domain.Product
	db.First(&p, "id = ?", product.ID)
	if p.Stock != 10 {
		t.Errorf("Stock not restored. Got %.2f, want 10", p.Stock)
	}
}

func TestParkedSalesAndInvoiceDeletion(t *testing.T) {
	saleService, _, _, cleanup := setupTestDB(t)
	defer cleanup()

	// Test DeleteSale (should fail because it's disabled)
	err := saleService.DeleteSale("any-id")
	if err == nil {
		t.Error("Expected error when attempting to delete a sale (invoices are non-deletable)")
	}

	// Test ParkSale
	parked, err := saleService.ParkSale(`[{"id":"p1","name":"Prod 1","qty":1}]`, "Guest", "cust_123", "Need wallet", 1000, 1)
	if err != nil {
		t.Fatalf("ParkSale failed: %v", err)
	}

	// Get count
	count, err := saleService.GetParkedSalesCount()
	if err != nil {
		t.Fatalf("GetParkedSalesCount failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1 parked sale, got %d", count)
	}

	// Get list
	list, err := saleService.GetParkedSales()
	if err != nil {
		t.Fatalf("GetParkedSales failed: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 parked sale in list, got %d", len(list))
	}

	// Retrieve by ID
	retrieved, err := saleService.RetrieveParkedSale(parked.ID)
	if err != nil {
		t.Fatalf("RetrieveParkedSale failed: %v", err)
	}
	if retrieved.Note != "Need wallet" {
		t.Errorf("Expected note 'Need wallet', got %s", retrieved.Note)
	}

	// Delete parked sale
	err = saleService.DeleteParkedSale(parked.ID)
	if err != nil {
		t.Fatalf("DeleteParkedSale failed: %v", err)
	}

	// Verify count is 0
	count, _ = saleService.GetParkedSalesCount()
	if count != 0 {
		t.Errorf("Expected 0 parked sales, got %d", count)
	}
}

func TestReturnSalePartial(t *testing.T) {
	saleService, _, db, cleanup := setupTestDB(t)
	defer cleanup()

	customer := createTestCustomer(t, db, "Partial Return Customer", 0)
	product := createTestProduct(t, db, "Keyboard", 10000, 5)

	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  customer.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Total:         domain.NewAmount(30000),
		Subtotal:      domain.NewAmount(30000),
		PaymentMethod: "credit",
		Status:        "pending",
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      product.Name,
			Quantity:  3,
			Price:     domain.NewAmount(10000),
			Total:     domain.NewAmount(30000),
		}},
	}

	if err := saleService.ProcessSale(&sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Verify initial stock (5 - 3 = 2)
	var p domain.Product
	db.First(&p, "id = ?", product.ID)
	if p.Stock != 2 {
		t.Fatalf("Expected stock to be 2, got %.2f", p.Stock)
	}

	// Verify initial customer debt (30,000)
	c := refreshCustomer(t, db, customer.ID)
	if c.Debt != domain.NewAmount(30000) {
		t.Fatalf("Expected debt 30,000, got %s", c.Debt.String())
	}

	// Return 1 item partially
	err := saleService.ReturnSalePartial(sale.ID, product.ID, 1.0)
	if err != nil {
		t.Fatalf("ReturnSalePartial failed: %v", err)
	}

	// Verify stock (2 + 1 = 3)
	db.First(&p, "id = ?", product.ID)
	if p.Stock != 3 {
		t.Errorf("Expected stock to be 3 after partial return, got %.2f", p.Stock)
	}

	// Verify customer debt (30,000 - 10,000 = 20,000)
	c = refreshCustomer(t, db, customer.ID)
	if c.Debt != domain.NewAmount(20000) {
		t.Errorf("Expected debt 20,000, got %s", c.Debt.String())
	}

	// Verify sale status is "partial_return"
	var updatedSale domain.Sale
	db.First(&updatedSale, "id = ?", sale.ID)
	if updatedSale.Status != "partial_return" {
		t.Errorf("Expected status 'partial_return', got %s", updatedSale.Status)
	}

	// Get sale items
	items, err := saleService.GetSaleItems(sale.ID)
	if err != nil {
		t.Fatalf("GetSaleItems failed: %v", err)
	}
	if len(items) != 1 || items[0].ReturnedQty != 1.0 {
		t.Errorf("Sale items returned quantity wrong: %v", items)
	}

	// Return remaining 2 items
	err = saleService.ReturnSalePartial(sale.ID, product.ID, 2.0)
	if err != nil {
		t.Fatalf("ReturnSalePartial for remaining quantity failed: %v", err)
	}

	// Verify sale status is now fully "returned"
	db.First(&updatedSale, "id = ?", sale.ID)
	if updatedSale.Status != "returned" {
		t.Errorf("Expected status to be 'returned', got %s", updatedSale.Status)
	}
}

func TestSaleService_ExtraCoverage(t *testing.T) {
	saleService, _, db, cleanup := setupTestDB(t)
	defer cleanup()

	// 1. Error constructors & SalesError.Error()
	errStock := service.ErrSalesInsufficientStock("Product A", 10.0, 15.0)
	if errStock.Code != service.ErrCodeSalesInsufficientStock {
		t.Errorf("Expected code %s, got %s", service.ErrCodeSalesInsufficientStock, errStock.Code)
	}
	if errStock.Error() == "" {
		t.Error("Expected error message to be non-empty")
	}

	errNoHint := &service.SalesError{
		Code:    service.ErrCodeInvalidPayment,
		Message: "Error without hint",
	}
	if errNoHint.Error() != "Error without hint" {
		t.Errorf("Expected 'Error without hint', got %s", errNoHint.Error())
	}

	if service.ErrInvalidPayment().Code != service.ErrCodeInvalidPayment {
		t.Error("ErrInvalidPayment failed")
	}
	if service.ErrEmptyCart().Code != service.ErrCodeEmptyCart {
		t.Error("ErrEmptyCart failed")
	}
	if service.ErrSalesNotFound("123").Code != service.ErrCodeSaleNotFound {
		t.Error("ErrSalesNotFound failed")
	}
	if service.ErrAlreadyReturned().Code != service.ErrCodeAlreadyReturned {
		t.Error("ErrAlreadyReturned failed")
	}
	if service.ErrSalesProductNotFound("id").Code != service.ErrCodeSalesProductNotFound {
		t.Error("ErrSalesProductNotFound failed")
	}
	if service.ErrSalesInvalidQuantity().Code != service.ErrCodeSalesInvalidQuantity {
		t.Error("ErrSalesInvalidQuantity failed")
	}
	if service.ErrPriceMismatch("P", domain.NewAmount(10), domain.NewAmount(20)).Code != service.ErrCodePriceMismatch {
		t.Error("ErrPriceMismatch failed")
	}

	// 2. GetSales and GetSale
	_, err := saleService.GetSales(1, 10, "", "", "")
	if err != nil {
		t.Errorf("GetSales failed: %v", err)
	}
	_, err = saleService.GetSale("non-existent-id")
	if err == nil {
		t.Error("Expected error looking up non-existent sale ID")
	}

	// 3. ProcessSale Validation Failures
	// Credit sale without customer ID
	creditNoCust := &domain.Sale{
		PaymentMethod: "credit",
		Items: []domain.SaleItem{{
			ProductID: "some-prod",
			Quantity:  1,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(creditNoCust); err == nil {
		t.Error("Expected error processing credit sale without customer ID")
	}

	// Installment sale without customer ID
	instNoCust := &domain.Sale{
		PaymentMethod: "installment",
		Items: []domain.SaleItem{{
			ProductID: "some-prod",
			Quantity:  1,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(instNoCust); err == nil {
		t.Error("Expected error processing installment sale without customer ID")
	}

	// Split sale with credit but no customer ID
	splitNoCust := &domain.Sale{
		PaymentMethod: "split",
		SplitDetails: map[string]domain.Amount{
			"credit": domain.NewAmount(50),
			"cash":   domain.NewAmount(50),
		},
		Items: []domain.SaleItem{{
			ProductID: "some-prod",
			Quantity:  1,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(splitNoCust); err == nil {
		t.Error("Expected error processing split sale with credit without customer ID")
	}

	// Negative quantity
	negQty := &domain.Sale{
		PaymentMethod: "cash",
		Items: []domain.SaleItem{{
			ProductID: "some-prod",
			Quantity:  -1,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(negQty); err == nil {
		t.Error("Expected error processing sale with negative quantity")
	}

	// Negative item discount
	negDisc := &domain.Sale{
		PaymentMethod: "cash",
		Items: []domain.SaleItem{{
			ProductID: "some-prod",
			Quantity:  1,
			Price:     domain.NewAmount(100),
			Discount:  domain.Amount(-10),
		}},
	}
	if err := saleService.ProcessSale(negDisc); err == nil {
		t.Error("Expected error processing sale with negative item discount")
	}

	// Item discount exceeds item total
	largeDisc := &domain.Sale{
		PaymentMethod: "cash",
		Items: []domain.SaleItem{{
			ProductID: "some-prod",
			Quantity:  1,
			Price:     domain.NewAmount(100),
			Discount:  domain.NewAmount(120),
		}},
	}
	if err := saleService.ProcessSale(largeDisc); err == nil {
		t.Error("Expected error processing sale where item discount exceeds total")
	}

	// 4. Stock and Price Checks inside ProcessSale
	cust := createTestCustomer(t, db, "Valid Customer", 0)
	prod := createTestProduct(t, db, "Stock Item", 100, 10)

	// Price Mismatch
	priceMis := &domain.Sale{
		CustomerID:    cust.ID,
		PaymentMethod: "cash",
		Items: []domain.SaleItem{{
			ProductID: prod.ID,
			Quantity:  1,
			Price:     domain.NewAmount(150),
		}},
	}
	if err := saleService.ProcessSale(priceMis); err == nil {
		t.Error("Expected error processing sale with price mismatch")
	}

	// Insufficient Stock
	insStock := &domain.Sale{
		CustomerID:    cust.ID,
		PaymentMethod: "cash",
		Items: []domain.SaleItem{{
			ProductID: prod.ID,
			Quantity:  20,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(insStock); err == nil {
		t.Error("Expected error processing sale with insufficient stock")
	}

	// Overall discount exceeds total
	overDisc := &domain.Sale{
		CustomerID:    cust.ID,
		PaymentMethod: "cash",
		Discount:      domain.NewAmount(200),
		Items: []domain.SaleItem{{
			ProductID: prod.ID,
			Quantity:  1,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(overDisc); err == nil {
		t.Error("Expected error when overall discount exceeds sale total")
	}

	// Product not found
	prodNotFound := &domain.Sale{
		CustomerID:    cust.ID,
		PaymentMethod: "cash",
		Items: []domain.SaleItem{{
			ProductID: "non-existent-product",
			Quantity:  1,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(prodNotFound); err == nil {
		t.Error("Expected error when product is not found")
	}

	// 5. DeleteSale
	if err := saleService.DeleteSale("some-id"); err == nil {
		t.Error("Expected error when deleting sale (disabled feature)")
	}

	// 6. ReturnSale Errors
	if err := saleService.ReturnSale("non-existent-sale"); err == nil {
		t.Error("Expected error when returning non-existent sale")
	}

	// Create a valid sale to return twice
	validSale := &domain.Sale{
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		PaymentMethod: "cash",
		Status:        "completed",
		Items: []domain.SaleItem{{
			ProductID: prod.ID,
			Quantity:  1,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(validSale); err != nil {
		t.Fatalf("Failed to process valid sale: %v", err)
	}

	if err := saleService.ReturnSale(validSale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	// Return already returned sale
	if err := saleService.ReturnSale(validSale.ID); err == nil {
		t.Error("Expected error when returning already returned sale")
	}

	// 7. ReturnSalePartial Errors
	// Create another sale
	validSale2 := &domain.Sale{
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		PaymentMethod: "cash",
		Status:        "completed",
		Items: []domain.SaleItem{{
			ProductID: prod.ID,
			Quantity:  2,
			Price:     domain.NewAmount(100),
		}},
	}
	if err := saleService.ProcessSale(validSale2); err != nil {
		t.Fatalf("Failed to process valid sale 2: %v", err)
	}

	// Return negative quantity
	if err := saleService.ReturnSalePartial(validSale2.ID, prod.ID, -1); err == nil {
		t.Error("Expected error when returning negative quantity")
	}

	// Return more than remaining quantity
	if err := saleService.ReturnSalePartial(validSale2.ID, prod.ID, 3); err == nil {
		t.Error("Expected error when returning more than remaining quantity")
	}
}