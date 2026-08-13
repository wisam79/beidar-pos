package service_test

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ════════════════════════════════════════════════════════════════════════════════
// 📐 Test Suite: Comprehensive Business Logic (25 tests)
// ════════════════════════════════════════════════════════════════════════════════

// ─── Helpers ────────────────────────────────────────────────────────────────

func setupBusinessTestDB(t *testing.T) (service.SaleService, service.PaymentService, service.FinanceService, service.CRMService, service.DiscountService, *gorm.DB, func()) {
	t.Helper()
	db, cleanup := testutil.SetupFullDB(t)
	testutil.SeedPreferences(t, db)

	prefRepo := repository.NewPreferencesRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	productRepo := repository.NewProductRepository(db)
	shiftRepo := repository.NewShiftRepository(db)
	saleRepo := repository.NewSaleRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	expenseRepo := repository.NewExpenseRepository(db)
	supplierRepo := repository.NewSupplierRepository(db)
	poRepo := repository.NewPurchaseOrderRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	discountRepo := repository.NewDiscountRepository(db)

	productService := service.NewProductService(productRepo)
	saleService := service.NewSaleService(saleRepo, productRepo, customerRepo, paymentRepo, shiftRepo, prefRepo, productService, auditRepo)
	paymentService := service.NewPaymentService(paymentRepo, customerRepo, saleRepo, shiftRepo, prefRepo)
	financeService := service.NewFinanceService(expenseRepo, shiftRepo, poRepo, supplierRepo, productRepo, prefRepo, productService)
	crmService := service.NewCRMService(customerRepo, supplierRepo, productRepo)
	discountService := service.NewDiscountService(discountRepo)

	return saleService, paymentService, financeService, crmService, discountService, db, cleanup
}

func makeSale(t *testing.T, productID, customerID string, price float64, method string) *domain.Sale {
	t.Helper()
	return &domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customerID,
		CustomerName:  "Test Customer",
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Total:         domain.NewAmount(price),
		Subtotal:      domain.NewAmount(price),
		PaymentMethod: method,
		Status:        "completed",
		Items: []domain.SaleItem{{
			ProductID: productID,
			Name:      "Test Product",
			Quantity:  1,
			Price:     domain.NewAmount(price),
			Total:     domain.NewAmount(price),
		}},
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 1. Credit sale creates debt, full payment clears it
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_CreditThenFullPayment_DebtCleared(t *testing.T) {
	saleService, paymentService, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Laptop", 500, 10)
	customer := testutil.NewCustomer(t, db, "Ahmad", 0)

	sale := makeSale(t, product.ID, customer.ID, 500, "credit")
	if err := saleService.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Debt != domain.NewAmount(500) {
		t.Fatalf("debt after credit sale = %s, want 500.00", c.Debt.String())
	}

	_, err := paymentService.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(500),
		Method:     "cash",
	})
	if err != nil {
		t.Fatalf("CreatePayment failed: %v", err)
	}

	c = testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Debt != domain.Zero() {
		t.Errorf("debt after full payment = %s, want 0.00", c.Debt.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 2. Overpayment rejected without force
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_Overpayment_RejectedWithoutForce(t *testing.T) {
	_, paymentService, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Karim", 100)

	_, err := paymentService.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(200),
		Method:     "cash",
	})
	if err == nil {
		t.Fatal("expected overpayment to be rejected")
	}

	appErr, ok := err.(*errors.AppError)
	if !ok {
		t.Fatalf("expected *errors.AppError, got %T", err)
	}
	if appErr.Code != "PAYMENT_EXCEEDS_DEBT" {
		t.Errorf("error code = %s, want PAYMENT_EXCEEDS_DEBT", appErr.Code)
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 3. Overpayment allowed with force
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_Overpayment_AllowedWithForce(t *testing.T) {
	_, paymentService, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Salem", 100)

	err := paymentService.CreatePaymentForced(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.NewAmount(200),
		Method:     "cash",
	})
	if err != nil {
		t.Fatalf("CreatePaymentForced should allow overpayment: %v", err)
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 4. Sale with zero-amount payment rejected
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_ZeroPayment_Rejected(t *testing.T) {
	_, paymentService, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	customer := testutil.NewCustomer(t, db, "Omar", 500)

	_, err := paymentService.CreatePayment(domain.Payment{
		CustomerID: customer.ID,
		Amount:     domain.Zero(),
		Method:     "cash",
	})
	if err == nil {
		t.Fatal("expected zero payment to be rejected")
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 5. Sale deducts stock correctly
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_ProcessSale_StockDeducted(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Phone", 300, 50)
	sale := makeSale(t, product.ID, "", 300, "cash")
	sale.Items[0].Quantity = 3

	if err := saleService.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	p := testutil.MustRefreshProduct(t, db, product.ID)
	if p.Stock != 47 {
		t.Errorf("stock after sale = %v, want 47", p.Stock)
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 6. Sale with insufficient stock rejected
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_ProcessSale_InsufficientStock(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Widget", 10, 2)
	sale := makeSale(t, product.ID, "", 10, "cash")
	sale.Items[0].Quantity = 5

	err := saleService.ProcessSale(sale)
	if err == nil {
		t.Fatal("expected insufficient stock error")
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 7. Return sale restores stock
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_ReturnSale_StockRestored(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Tablet", 200, 20)
	sale := makeSale(t, product.ID, "", 200, "cash")
	sale.Items[0].Quantity = 5

	if err := saleService.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	p := testutil.MustRefreshProduct(t, db, product.ID)
	if p.Stock != 15 {
		t.Fatalf("stock after sale = %v, want 15", p.Stock)
	}

	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	p = testutil.MustRefreshProduct(t, db, product.ID)
	if p.Stock != 20 {
		t.Errorf("stock after return = %v, want 20", p.Stock)
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 8. Double return rejected
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_DoubleReturn_Rejected(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Monitor", 500, 10)
	sale := makeSale(t, product.ID, "", 500, "cash")

	if err := saleService.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}
	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("First ReturnSale failed: %v", err)
	}
	if err := saleService.ReturnSale(sale.ID); err == nil {
		t.Fatal("expected second return to be rejected")
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 9. Return credit sale reverts debt
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_ReturnCreditSale_DebtReverted(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Printer", 150, 10)
	customer := testutil.NewCustomer(t, db, "Zaid", 0)

	sale := makeSale(t, product.ID, customer.ID, 150, "credit")
	if err := saleService.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Debt != domain.NewAmount(150) {
		t.Fatalf("debt after credit sale = %s, want 150.00", c.Debt.String())
	}

	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	c = testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Debt != domain.Zero() {
		t.Errorf("debt after return = %s, want 0.00", c.Debt.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 10. Discount capped by MaxDiscount
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_DiscountCappedByMax(t *testing.T) {
	_, _, _, _, discountService, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	d := domain.Discount{
		Name:        "Big Sale",
		Type:        "percentage",
		Value:       50,
		MaxDiscount: domain.NewAmount(100),
		Active:      true,
	}
	created, err := discountService.CreateDiscount(d)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	amount, err := discountService.CalculateDiscountAmount(created.ID, domain.NewAmount(500), 1)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}

	if amount != domain.NewAmount(100) {
		t.Errorf("discount = %s, want 100.00 (capped)", amount.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 11. Percentage discount below cap
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_PercentageDiscountBelowCap(t *testing.T) {
	_, _, _, _, discountService, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	d := domain.Discount{
		Name:        "Small Discount",
		Type:        "percentage",
		Value:       10,
		MaxDiscount: domain.NewAmount(1000),
		Active:      true,
	}
	created, err := discountService.CreateDiscount(d)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	amount, err := discountService.CalculateDiscountAmount(created.ID, domain.NewAmount(200), 1)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}

	// 200 * 10% = 20
	if amount != domain.NewAmount(20) {
		t.Errorf("discount = %s, want 20.00", amount.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 12. Fixed discount
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_FixedDiscount(t *testing.T) {
	_, _, _, _, discountService, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	d := domain.Discount{
		Name:   "Fixed 50",
		Type:   "fixed",
		Value:  50,
		Active: true,
	}
	created, err := discountService.CreateDiscount(d)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	amount, err := discountService.CalculateDiscountAmount(created.ID, domain.NewAmount(500), 1)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}

	if amount != domain.NewAmount(50) {
		t.Errorf("discount = %s, want 50.00", amount.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 13. Discount below minimum purchase returns zero
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_DiscountBelowMinPurchase(t *testing.T) {
	_, _, _, _, discountService, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	d := domain.Discount{
		Name:        "Min100",
		Type:        "percentage",
		Value:       10,
		MinPurchase: domain.NewAmount(100),
		Active:      true,
	}
	created, err := discountService.CreateDiscount(d)
	if err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	amount, err := discountService.CalculateDiscountAmount(created.ID, domain.NewAmount(50), 1)
	if err != nil {
		t.Fatalf("CalculateDiscountAmount failed: %v", err)
	}

	if amount != domain.Zero() {
		t.Errorf("discount below minPurchase = %s, want 0.00", amount.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 14. Customer points awarded on cash sale
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_PointsAwardedOnSale(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "TV", 2000, 10)
	customer := testutil.NewCustomer(t, db, "Nasser", 0)

	sale := makeSale(t, product.ID, customer.ID, 2000, "cash")
	if err := saleService.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	// Points = Total / 1000 = 200000c / 1000 = 200
	if c.Points != 200 {
		t.Errorf("points = %d, want 200", c.Points)
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 15. Return sale reverts points
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_ReturnSale_PointsReverted(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Fridge", 3000, 10)
	customer := testutil.NewCustomer(t, db, "Hassan", 0)

	sale := makeSale(t, product.ID, customer.ID, 3000, "cash")
	if err := saleService.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	if err := saleService.ReturnSale(sale.ID); err != nil {
		t.Fatalf("ReturnSale failed: %v", err)
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Points != 0 {
		t.Errorf("points after return = %d, want 0", c.Points)
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 16. TotalPurchases incremented on sale
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_TotalPurchasesIncremented(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Speaker", 100, 50)
	customer := testutil.NewCustomer(t, db, "Ali", 0)

	for i := 0; i < 3; i++ {
		sale := makeSale(t, product.ID, customer.ID, 100, "cash")
		if err := saleService.ProcessSale(sale); err != nil {
			t.Fatalf("ProcessSale %d failed: %v", i, err)
		}
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.TotalPurchases != domain.NewAmount(300) {
		t.Errorf("totalPurchases = %s, want 300.00", c.TotalPurchases.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 17. Split payment: cash + credit
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_SplitPayment_CashAndCredit(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Router", 200, 10)
	customer := testutil.NewCustomer(t, db, "Samir", 0)

	sale := &domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  "Samir",
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Total:         domain.NewAmount(200),
		Subtotal:      domain.NewAmount(200),
		PaymentMethod: "split",
		Status:        "completed",
		SplitDetails: map[string]domain.Amount{
			"cash":   domain.NewAmount(120),
			"credit": domain.NewAmount(80),
		},
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      "Router",
			Quantity:  1,
			Price:     domain.NewAmount(200),
			Total:     domain.NewAmount(200),
		}},
	}

	if err := saleService.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale(split) failed: %v", err)
	}

	c := testutil.MustRefreshCustomer(t, db, customer.ID)
	if c.Debt != domain.NewAmount(80) {
		t.Errorf("debt after split = %s, want 80.00", c.Debt.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 18. Split payment invalid sum rejected
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_SplitPayment_InvalidSum_Rejected(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Cable", 100, 10)

	sale := &domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    "",
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Total:         domain.NewAmount(100),
		Subtotal:      domain.NewAmount(100),
		PaymentMethod: "split",
		Status:        "completed",
		SplitDetails: map[string]domain.Amount{
			"cash":   domain.NewAmount(50),
			"credit": domain.NewAmount(40), // total 90, should be 100
		},
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      "Cable",
			Quantity:  1,
			Price:     domain.NewAmount(100),
			Total:     domain.NewAmount(100),
		}},
	}

	err := saleService.ProcessSale(sale)
	if err == nil {
		t.Fatal("expected split sum mismatch to be rejected")
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 19. Negative discount rejected
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_NegativeDiscount_Rejected(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Gadget", 100, 10)

	sale := makeSale(t, product.ID, "", 100, "cash")
	sale.Discount = domain.NewAmount(-10) // negative

	err := saleService.ProcessSale(sale)
	if err == nil {
		t.Fatal("expected negative discount to be rejected")
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 20. Park and retrieve sale
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_ParkAndRetrieveSale(t *testing.T) {
	saleService, _, _, _, _, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	parked, err := saleService.ParkSale(
		`[{"id":"p1","name":"Item","qty":2,"price":100}]`,
		"Walk-in",
		"",
		"Test parked",
		domain.NewAmount(200),
		2,
	)
	if err != nil {
		t.Fatalf("ParkSale failed: %v", err)
	}

	retrieved, err := saleService.RetrieveParkedSale(parked.ID)
	if err != nil {
		t.Fatalf("RetrieveParkedSale failed: %v", err)
	}
	if retrieved.Total != domain.NewAmount(200) {
		t.Errorf("retrieved total = %s, want 200.00", retrieved.Total.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 21. Delete parked sale
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_DeleteParkedSale(t *testing.T) {
	saleService, _, _, _, _, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	parked, err := saleService.ParkSale(
		`[{"id":"p1","name":"Item","qty":1,"price":50}]`,
		"",
		"",
		"",
		domain.NewAmount(50),
		1,
	)
	if err != nil {
		t.Fatalf("ParkSale failed: %v", err)
	}

	if err := saleService.DeleteParkedSale(parked.ID); err != nil {
		t.Fatalf("DeleteParkedSale failed: %v", err)
	}

	_, err = saleService.RetrieveParkedSale(parked.ID)
	if err == nil {
		t.Fatal("expected deleted parked sale to not be found")
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 22. Customer CRUD
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_CustomerCRUD(t *testing.T) {
	_, _, _, crmService, _, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	customer := domain.Customer{
		Name:  "عميل اختبار",
		Phone: "0770000001",
	}
	if err := crmService.SaveCustomer(customer); err != nil {
		t.Fatalf("SaveCustomer (create) failed: %v", err)
	}

	customers, err := crmService.GetCustomers()
	if err != nil {
		t.Fatalf("GetCustomers failed: %v", err)
	}
	if len(customers) != 1 {
		t.Fatalf("expected 1 customer, got %d", len(customers))
	}
	if customers[0].Name != "عميل اختبار" {
		t.Errorf("name = %q, want عميل اختبار", customers[0].Name)
	}

	savedCustomer := customers[0]
	savedCustomer.Name = "عميل محدث"
	if err := crmService.SaveCustomer(savedCustomer); err != nil {
		t.Fatalf("SaveCustomer (update) failed: %v", err)
	}

	customers, err = crmService.GetCustomers()
	if err != nil {
		t.Fatalf("GetCustomers after update failed: %v", err)
	}
	if customers[0].Name != "عميل محدث" {
		t.Errorf("updated name = %q, want عميل محدث", customers[0].Name)
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 23. Expense CRUD
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_ExpenseCRUD(t *testing.T) {
	_, _, financeService, _, _, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	expense := domain.Expense{
		Title:    "إيجار المحل",
		Amount:   domain.NewAmount(5000),
		Date:     "2026-08-01",
		Category: "rent",
	}
	if err := financeService.SaveExpense(expense); err != nil {
		t.Fatalf("SaveExpense failed: %v", err)
	}

	expenses, err := financeService.GetExpenses("2026-08")
	if err != nil {
		t.Fatalf("GetExpenses failed: %v", err)
	}
	if len(expenses) != 1 {
		t.Fatalf("expected 1 expense, got %d", len(expenses))
	}
	if expenses[0].Amount != domain.NewAmount(5000) {
		t.Errorf("expense amount = %s, want 5000.00", expenses[0].Amount.String())
	}

	savedExpense := expenses[0]
	if err := financeService.DeleteExpense(savedExpense.ID); err != nil {
		t.Fatalf("DeleteExpense failed: %v", err)
	}

	expenses, err = financeService.GetExpenses("2026-08")
	if err != nil {
		t.Fatalf("GetExpenses after delete failed: %v", err)
	}
	if len(expenses) != 0 {
		t.Errorf("expected 0 expenses after delete, got %d", len(expenses))
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 24. Installment plan calculation
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_InstallmentPlanCalculation(t *testing.T) {
	_, paymentService, _, _, _, _, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	plan, err := paymentService.CalculateInstallmentPlan(
		domain.NewAmount(1000),
		domain.NewAmount(200),
		4,
	)
	if err != nil {
		t.Fatalf("CalculateInstallmentPlan failed: %v", err)
	}

	if plan.TotalAmount != domain.NewAmount(1000) {
		t.Errorf("totalAmount = %s, want 1000.00", plan.TotalAmount.String())
	}
	if plan.DownPayment != domain.NewAmount(200) {
		t.Errorf("downPayment = %s, want 200.00", plan.DownPayment.String())
	}
	if len(plan.Schedule) != 4 {
		t.Fatalf("schedule length = %d, want 4", len(plan.Schedule))
	}

	var scheduleSum domain.Amount
	for _, inst := range plan.Schedule {
		scheduleSum = scheduleSum.Add(inst.Amount)
	}
	remaining := plan.TotalAmount.Sub(plan.DownPayment)
	if scheduleSum != remaining {
		t.Errorf("schedule sum = %s, remaining = %s, should match", scheduleSum.String(), remaining.String())
	}
}

// ════════════════════════════════════════════════════════════════════════════════
// 25. Installment down payment exceeds total rejected
// ════════════════════════════════════════════════════════════════════════════════

func TestBiz_InstallmentDownPaymentExceedsTotal(t *testing.T) {
	saleService, _, _, _, _, db, cleanup := setupBusinessTestDB(t)
	defer cleanup()

	product := testutil.NewProduct(t, db, "Camera", 500, 10)
	customer := testutil.NewCustomer(t, db, "Fahad", 0)

	sale := &domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    customer.ID,
		CustomerName:  "Fahad",
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Total:         domain.NewAmount(500),
		Subtotal:      domain.NewAmount(500),
		PaymentMethod: "installment",
		Status:        "completed",
		InstallmentPlan: &domain.InstallmentPlan{
			TotalAmount: domain.NewAmount(500),
			DownPayment: domain.NewAmount(600), // exceeds total
			Months:      3,
			StartDate:   "2026-08-01",
		},
		Items: []domain.SaleItem{{
			ProductID: product.ID,
			Name:      "Camera",
			Quantity:  1,
			Price:     domain.NewAmount(500),
			Total:     domain.NewAmount(500),
		}},
	}

	err := saleService.ProcessSale(sale)
	if err == nil {
		t.Fatal("expected down payment > total to be rejected")
	}
}
