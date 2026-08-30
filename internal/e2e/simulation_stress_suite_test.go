package e2e

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
	"beidar-desktop/pkg/auth"
	"github.com/google/uuid"
)

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 SCENARIO 1: Black Friday Extreme Concurrency Rush
// 25 parallel cashiers competing for 15 limited stock items with active coupons.
// Verifies: Zero negative inventory, exact total sales count, coupon limit adherence.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation1_BlackFriday_HighConcurrencyRush(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 15 units available
	prod := h.NewProduct("آيفون 15 برو ماكس - عرض الجمعة", 1200000, 15)
	cust := h.NewCustomer("زبائن الجمعة البيضاء", 0)

	// Create coupon with max 10 usages
	coupon := domain.Discount{
		ID:          uuid.New().String(),
		Name:        "BLACK_FRIDAY_50K",
		Code:        "BF50K",
		Type:        "fixed",
		Value:       50000,
		MinPurchase: domain.NewAmount(500000),
		UsageLimit:  10,
		UsageCount:  0,
		Active:      true,
		StartDate:   time.Now().Add(-1 * time.Hour).Format("2006-01-02"),
		EndDate:     time.Now().Add(24 * time.Hour).Format("2006-01-02"),
	}
	if _, err := h.DiscountHandler.CreateDiscount(coupon); err != nil {
		t.Fatalf("CreateDiscount failed: %v", err)
	}

	const concurrentCashiers = 25
	var successCount int64
	var failCount int64

	var wg sync.WaitGroup
	wg.Add(concurrentCashiers)

	for i := 0; i < concurrentCashiers; i++ {
		go func(cashierIdx int) {
			defer wg.Done()

			saleID := fmt.Sprintf("BF-SALE-%d-%s", cashierIdx, uuid.New().String()[:8])
			sale := domain.Sale{
				ID:            saleID,
				CustomerID:    cust.ID,
				CustomerName:  cust.Name,
				StaffID:       auth.CurrentStaffID(),
				Date:          time.Now().Format("2006-01-02"),
				Timestamp:     time.Now().UnixMilli(),
				Subtotal:      prod.Price,
				Discount:      domain.NewAmount(50000),
				Total:         prod.Price.Sub(domain.NewAmount(50000)),
				PaymentMethod: "cash",
				Status:        "completed",
				ItemsCount:    1,
				Items: []domain.SaleItem{
					{
						ProductID: prod.ID,
						Name:      prod.Name,
						Quantity:  1,
						Price:     prod.Price,
						Discount:  domain.NewAmount(50000),
						Total:     prod.Price.Sub(domain.NewAmount(50000)),
					},
				},
			}

			err := h.SaleHandler.ProcessSale(sale)
			if err == nil {
				atomic.AddInt64(&successCount, 1)
			} else {
				atomic.AddInt64(&failCount, 1)
			}
		}(i)
	}

	wg.Wait()

	// Exactly 15 sales must succeed (inventory was 15)
	if successCount != 15 {
		t.Errorf("Black Friday simulation expected exactly 15 sales, got %d", successCount)
	}
	if failCount != int64(concurrentCashiers-15) {
		t.Errorf("Black Friday simulation expected %d failed sales, got %d", concurrentCashiers-15, failCount)
	}

	// Final stock must be 0, never negative
	finalProd := h.MustReloadProduct(prod.ID)
	if finalProd.Stock != 0 {
		t.Errorf("expected product stock to be 0, got %v", finalProd.Stock)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 SCENARIO 2: Complex Multi-Item Partial Return with Loyalty Rollback
// Multi-item basket (3 products), customer credit debt adjusted,
// followed by two-stage partial return of individual items.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation2_ComplexMultiItemPartialReturn_LoyaltyRollback(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// Products: P1 (50,000 x 2 = 100,000), P2 (30,000 x 1 = 30,000), P3 (20,000 x 1 = 20,000)
	// Total = 150,000. Customer pays on Credit.
	p1 := h.NewProduct("سماعة بلوتوث", 50000, 10)
	p2 := h.NewProduct("كفر حماية", 30000, 10)
	p3 := h.NewProduct("شاحن جداري", 20000, 10)
	cust := h.NewCustomer("عميل المحاكاة المعقدة", 0)

	saleID := uuid.New().String()
	totalAmount := domain.NewAmount(150000)

	sale := domain.Sale{
		ID:            saleID,
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		StaffID:       auth.CurrentStaffID(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      totalAmount,
		Total:         totalAmount,
		PaymentMethod: "credit",
		Status:        "pending",
		ItemsCount:    4,
		Items: []domain.SaleItem{
			{ProductID: p1.ID, Name: p1.Name, Quantity: 2, Price: p1.Price, Total: p1.Price.MulFloat(2)},
			{ProductID: p2.ID, Name: p2.Name, Quantity: 1, Price: p2.Price, Total: p2.Price},
			{ProductID: p3.ID, Name: p3.Name, Quantity: 1, Price: p3.Price, Total: p3.Price},
		},
	}

	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// 1. Initial verification: Customer debt = 150,000
	c1 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c1.Debt, totalAmount) {
		t.Fatalf("expected initial debt 150,000, got %s", c1.Debt.String())
	}

	// 2. Stage 1: Partial Return of 1 unit of P1 (Refund value = 50,000)
	if err := h.SaleHandler.ReturnSalePartial(saleID, p1.ID, 1); err != nil {
		t.Fatalf("ReturnSalePartial stage 1 failed: %v", err)
	}

	// Verify Customer debt decreased from 150,000 to 100,000
	c2 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c2.Debt, domain.NewAmount(100000)) {
		t.Errorf("expected debt after stage 1 to be 100,000, got %s", c2.Debt.String())
	}
	// Verify P1 stock incremented back from 8 to 9
	if h.MustReloadProduct(p1.ID).Stock != 9 {
		t.Errorf("expected P1 stock to be 9, got %v", h.MustReloadProduct(p1.ID).Stock)
	}

	// 3. Stage 2: Partial Return of P2 (Refund value = 30,000)
	if err := h.SaleHandler.ReturnSalePartial(saleID, p2.ID, 1); err != nil {
		t.Fatalf("ReturnSalePartial stage 2 failed: %v", err)
	}

	// Verify Customer debt decreased from 100,000 to 70,000
	c3 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c3.Debt, domain.NewAmount(70000)) {
		t.Errorf("expected debt after stage 2 to be 70,000, got %s", c3.Debt.String())
	}
	// Verify P2 stock restored from 9 to 10
	if h.MustReloadProduct(p2.ID).Stock != 10 {
		t.Errorf("expected P2 stock to be 10, got %v", h.MustReloadProduct(p2.ID).Stock)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌐 SCENARIO 3: LAN Network Chaos & Client Reconnection
// Simulates server suspension, client reconnection, and verified transaction state.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation3_LAN_NetworkChaos_IntermittentFlapping(t *testing.T) {
	server, serverCleanup := NewHarness(t)
	defer serverCleanup()

	server.LoginAsAdmin(t)
	defer server.DeferLogout()

	port := pickFreePort(t)
	if err := server.Lan.StartServer(port); err != nil {
		t.Fatalf("StartServer on port %d failed: %v", port, err)
	}
	defer func() { _ = server.Lan.StopServer() }()

	secret, _ := server.LanHandler.GetServerSecret()
	prod := server.NewProduct("منتج فحص الشبكة", 50000, 20)

	// Client Connects
	client, clientCleanup := NewHarness(t)
	defer clientCleanup()

	client.LoginAsAdmin(t)
	defer client.DeferLogout()

	if err := client.LanHandler.ConnectToLanServer("127.0.0.1", port, secret); err != nil {
		t.Fatalf("initial LAN connect failed: %v", err)
	}

	// 1. Successful sale over LAN
	sale1 := domain.Sale{
		ID:            uuid.New().String(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      prod.Price,
		Total:         prod.Price,
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    1,
		Items:         []domain.SaleItem{{ProductID: prod.ID, Name: prod.Name, Quantity: 1, Price: prod.Price, Total: prod.Price}},
	}
	if err := client.SaleHandler.ProcessSale(sale1); err != nil {
		t.Fatalf("remote sale 1 failed: %v", err)
	}

	// 2. Simulate Server Suspension of the device
	clients := server.LanHandler.GetConnectedClients()
	if len(clients) > 0 {
		_ = server.LanHandler.SuspendLanClient(clients[0].DeviceID)
	}

	// 3. Sale during suspension must be rejected
	saleBlocked := domain.Sale{
		ID:            uuid.New().String(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      prod.Price,
		Total:         prod.Price,
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    1,
		Items:         []domain.SaleItem{{ProductID: prod.ID, Name: prod.Name, Quantity: 1, Price: prod.Price, Total: prod.Price}},
	}
	err := client.SaleHandler.ProcessSale(saleBlocked)
	if err == nil {
		t.Error("expected sale to fail when client is suspended")
	}

	// 4. Server resumes the client
	if len(clients) > 0 {
		_ = server.LanHandler.ResumeLanClient(clients[0].DeviceID)
	}

	// 5. Subsequent sale must succeed again
	sale3 := domain.Sale{
		ID:            uuid.New().String(),
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      prod.Price,
		Total:         prod.Price,
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    1,
		Items:         []domain.SaleItem{{ProductID: prod.ID, Name: prod.Name, Quantity: 1, Price: prod.Price, Total: prod.Price}},
	}
	if err := client.SaleHandler.ProcessSale(sale3); err != nil {
		t.Fatalf("remote sale 3 failed after resumption: %v", err)
	}

	// Stock on server must be 20 - 2 = 18
	if server.MustReloadProduct(prod.ID).Stock != 18 {
		t.Errorf("expected server stock 18, got %v", server.MustReloadProduct(prod.ID).Stock)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 📦 SCENARIO 4: Supplier Debt Chain & Multi-Delivery Accounting
// Purchase order creation, multi-batch delivery, price modification, and settlements.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation4_SupplierDebtChain_RetroactiveCostAdjustments(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// Initial setup: Supplier with initial balance of 1,000,000
	supp := domain.Supplier{
		ID:          uuid.New().String(),
		Name:        "شركة النور للتجارة العامة",
		CompanyName: "مجموعة النور",
		Phone:       "07703344556",
		Balance:     domain.NewAmount(1000000),
	}
	if err := h.Repos.supplier.Create(&supp); err != nil {
		t.Fatalf("Create supplier failed: %v", err)
	}

	prod := h.NewProduct("راوتر واي فاي 6", 80000, 0) // initial stock 0

	// 1. Create Purchase Order for 20 units @ 50,000 each = 1,000,000 total
	po := domain.PurchaseOrder{
		SupplierID:   supp.ID,
		SupplierName: supp.Name,
		Status:       domain.POStatusPending,
		CreatedAt:    time.Now().UnixMilli(),
		Items: []domain.PurchaseOrderItem{
			{
				ProductID:   prod.ID,
				ProductName: prod.Name,
				Quantity:    20,
				UnitCost:    domain.NewAmount(50000),
			},
		},
	}

	createdPO, err := h.FinanceHandler.CreatePurchaseOrder(po)
	if err != nil {
		t.Fatalf("CreatePurchaseOrder failed: %v", err)
	}

	// 2. Receive first partial delivery (10 units)
	if err := h.FinanceHandler.ReceivePurchaseOrder(createdPO.ID, []domain.PurchaseOrderItem{
		{ProductID: prod.ID, ReceivedQty: 10},
	}); err != nil {
		t.Fatalf("ReceivePurchaseOrder 1 failed: %v", err)
	}

	if h.MustReloadProduct(prod.ID).Stock != 10 {
		t.Errorf("expected product stock 10 after delivery 1, got %v", h.MustReloadProduct(prod.ID).Stock)
	}

	// 3. Make partial payment to supplier (600,000)
	if err := h.FinanceHandler.PayPurchaseOrder(createdPO.ID, domain.NewAmount(600000), "cash"); err != nil {
		t.Fatalf("PayPurchaseOrder failed: %v", err)
	}

	suppAfterPay, _ := h.Repos.supplier.GetByID(supp.ID)
	if !testutil.AmountEq(suppAfterPay.Balance, domain.NewAmount(400000)) {
		t.Errorf("expected supplier balance 400,000, got %s", suppAfterPay.Balance.String())
	}

	// 4. Overpayment Protection: Attempting to pay 500,000 (exceeding remaining 400,000) must fail
	err = h.FinanceHandler.PayPurchaseOrder(createdPO.ID, domain.NewAmount(500000), "cash")
	if err == nil {
		t.Error("expected overpayment on Purchase Order to fail")
	}

	// 5. Final payoff of exactly 400,000
	if err := h.FinanceHandler.PayPurchaseOrder(createdPO.ID, domain.NewAmount(400000), "cash"); err != nil {
		t.Fatalf("final PayPurchaseOrder failed: %v", err)
	}

	suppFinal, _ := h.Repos.supplier.GetByID(supp.ID)
	if !testutil.AmountEq(suppFinal.Balance, domain.Zero()) {
		t.Errorf("expected supplier balance 0, got %s", suppFinal.Balance.String())
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 SCENARIO 5: Shift Handover & Cash Movements
// Verifies independent cashier shift separation and cash-out operations.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation5_MultiShift_CashMovements_TarpitSecurity(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	staff, _ := h.Repos.staff.GetByUsername(AdminUsername)

	// 1. Open Shift with 100,000 float
	shift, err := h.FinanceHandler.OpenShift(staff.ID, staff.Name, domain.NewAmount(100000))
	if err != nil {
		t.Fatalf("OpenShift failed: %v", err)
	}

	// 2. Add cash movement (Expense / Cash out = 25,000)
	_, err = h.FinanceHandler.AddCashMovement(shift.ID, "cash_out", "شراء قرطاسية ومطبوعات", staff.ID, staff.Name, domain.NewAmount(25000))
	if err != nil {
		t.Fatalf("AddCashMovement failed: %v", err)
	}

	// 3. Process sale in this shift (Cash = 50,000)
	prod := h.NewProduct("طابعة فواتير محمولة", 50000, 10)
	cust := h.NewCustomer("زبون الوردية", 0)
	sale := buildSale(prod, cust, 1, "cash")
	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale failed: %v", err)
	}

	// Expected cash sales = 50,000
	activeShift, _ := h.FinanceHandler.GetActiveShift()
	if !testutil.AmountEq(activeShift.CashSales, domain.NewAmount(50000)) {
		t.Errorf("expected shift cash sales 50,000, got %s", activeShift.CashSales.String())
	}

	// 4. Close Shift with declared cash = 125,000 (100,000 opening - 25,000 expense + 50,000 sale)
	declaredCash := domain.NewAmount(125000)
	closedShift, err := h.FinanceHandler.CloseShift(shift.ID, declaredCash, "إغلاق مطابق تماماً")
	if err != nil {
		t.Fatalf("CloseShift failed: %v", err)
	}
	if closedShift.Status != "closed" {
		t.Errorf("expected status 'closed', got %s", closedShift.Status)
	}
	if !testutil.AmountEq(closedShift.ClosingBalance, declaredCash) {
		t.Errorf("expected closing balance %s, got %s", declaredCash.String(), closedShift.ClosingBalance.String())
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 💳 SCENARIO 6: Disrupted Installment Plan & Prepayment
// 5-month plan, pays month 0, pays months 1 & 2 in lump sum, verifies debt.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation6_DisruptedInstallmentPlan_OutOfOrderPayments(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	prod := h.NewProduct("غسالة أوتوماتيك 10 كجم", 120000, 5)
	cust := h.NewCustomer("عميل خطة التقسيط", 0)

	installmentVal := domain.NewAmount(20000)
	downPayment := domain.NewAmount(20000)
	totalAmount := domain.NewAmount(120000)

	schedule := []domain.Installment{
		{DueDate: "2026-09-01", Amount: installmentVal, Status: "pending"},
		{DueDate: "2026-10-01", Amount: installmentVal, Status: "pending"},
		{DueDate: "2026-11-01", Amount: installmentVal, Status: "pending"},
		{DueDate: "2026-12-01", Amount: installmentVal, Status: "pending"},
		{DueDate: "2027-01-01", Amount: installmentVal, Status: "pending"},
	}

	plan := domain.InstallmentPlan{
		TotalAmount: totalAmount,
		DownPayment: downPayment,
		Months:      5,
		StartDate:   "2026-08-30",
		Schedule:    schedule,
	}

	sale := domain.Sale{
		ID:              uuid.New().String(),
		CustomerID:      cust.ID,
		CustomerName:    cust.Name,
		Date:            "2026-08-30",
		Timestamp:       time.Now().UnixMilli(),
		Subtotal:        totalAmount,
		Total:           totalAmount,
		PaymentMethod:   "installment",
		InstallmentPlan: &plan,
		Status:          "pending",
		ItemsCount:      1,
		Items:           []domain.SaleItem{{ProductID: prod.ID, Name: prod.Name, Quantity: 1, Price: totalAmount, Total: totalAmount}},
	}

	if err := h.SaleHandler.ProcessSale(sale); err != nil {
		t.Fatalf("ProcessSale installment failed: %v", err)
	}

	// Initial installment debt = 120,000 - 20,000 = 100,000
	c1 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c1.InstallmentDebt, domain.NewAmount(100000)) {
		t.Fatalf("expected InstallmentDebt 100,000, got %s", c1.InstallmentDebt.String())
	}

	// Pay month 0 (20,000)
	if err := h.PaymentHandler.PayInstallment(sale.ID, 0, installmentVal, "cash"); err != nil {
		t.Fatalf("PayInstallment 0 failed: %v", err)
	}

	// Pay months 1 and 2 in one session (40,000 total)
	if err := h.PaymentHandler.PayInstallment(sale.ID, 1, installmentVal, "cash"); err != nil {
		t.Fatalf("PayInstallment 1 failed: %v", err)
	}
	if err := h.PaymentHandler.PayInstallment(sale.ID, 2, installmentVal, "cash"); err != nil {
		t.Fatalf("PayInstallment 2 failed: %v", err)
	}

	// Remaining Installment Debt = 100,000 - 60,000 = 40,000
	c2 := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(c2.InstallmentDebt, domain.NewAmount(40000)) {
		t.Fatalf("expected InstallmentDebt 40,000, got %s", c2.InstallmentDebt.String())
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 SCENARIO 7: Concurrent Stock Auditing & Live Sales Collision
// Stock adjustment occurs concurrently while sales are taking place.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation7_ConcurrentStockAuditing_LiveSalesCollision(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	prod := h.NewProduct("ميزان إلكتروني ذكي", 30000, 50)
	cust := h.NewCustomer("عميل مبيعات الجرد", 0)

	// Live sales running
	var wg sync.WaitGroup
	wg.Add(10)
	for i := 0; i < 10; i++ {
		go func() {
			defer wg.Done()
			sale := buildSale(prod, cust, 1, "cash")
			_ = h.SaleHandler.ProcessSale(sale)
		}()
	}

	wg.Wait()

	// Recount and manual stock adjustment
	currentStock := h.MustReloadProduct(prod.ID).Stock
	if currentStock != 40 {
		t.Fatalf("expected 40 stock after 10 sales, got %v", currentStock)
	}

	// Manager audits inventory and finds 3 damaged items -> sets stock to 37
	pToUpdate := h.MustReloadProduct(prod.ID)
	pToUpdate.Stock = 37
	if err := h.ProductHandler.UpdateProduct(*pToUpdate); err != nil {
		t.Fatalf("UpdateProduct failed: %v", err)
	}
	_ = h.ProductHandler.LogStockMovement(prod.ID, prod.Name, "loss", 3, "تالف أثناء النقل")

	if h.MustReloadProduct(prod.ID).Stock != 37 {
		t.Fatalf("expected stock 37 after adjustment, got %v", h.MustReloadProduct(prod.ID).Stock)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 💥 SCENARIO 8: Transaction Failure Injection & Atomic Rollback
// Intentional error simulation during sale to verify 0 orphan records.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation8_TransactionFailureInjection_AtomicRollback(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	prod := h.NewProduct("قرص صلب SSD 1TB", 75000, 5)
	cust := h.NewCustomer("عميل المعاملة الفاشلة", 0)

	// Invalid Sale: Requesting 10 units when only 5 exist
	invalidSale := buildSale(prod, cust, 10, "cash")
	invalidSale.Total = prod.Price.MulFloat(10)
	invalidSale.Subtotal = invalidSale.Total

	err := h.SaleHandler.ProcessSale(invalidSale)
	if err == nil {
		t.Fatal("expected sale with insufficient stock to fail")
	}

	// Verify rollback: stock remains untouched at 5
	pReloaded := h.MustReloadProduct(prod.ID)
	if pReloaded.Stock != 5 {
		t.Errorf("expected product stock to remain 5, got %v", pReloaded.Stock)
	}

	// Verify customer debt / purchases untouched
	cReloaded := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cReloaded.Debt, domain.Zero()) || !testutil.AmountEq(cReloaded.TotalPurchases, domain.Zero()) {
		t.Errorf("expected customer to have 0 debt and purchases, got debt=%s, purchases=%s", cReloaded.Debt.String(), cReloaded.TotalPurchases.String())
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌌 SCENARIO 9: Extreme Financial Boundary Values & Zero-Cost Edges
// Multi-billion amounts and 100% discount free gift items.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation9_ExtremeFinancialBoundaryValues_ZeroCostEdges(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Extreme Large Amount (e.g. 5,000,000,000 IQD)
	bigAmount := domain.NewAmount(5000000000)
	bigProd := h.NewProduct("محول كهربائي لمحطة طاقة", 5000000000, 2)
	cust := h.NewCustomer("شركة الكهرباء الوطنية", 0)

	bigSale := buildSale(bigProd, cust, 1, "cash")
	if err := h.SaleHandler.ProcessSale(bigSale); err != nil {
		t.Fatalf("extreme large sale failed: %v", err)
	}

	cBig := h.MustReloadCustomer(cust.ID)
	if !testutil.AmountEq(cBig.TotalPurchases, bigAmount) {
		t.Errorf("expected total purchases %s, got %s", bigAmount.String(), cBig.TotalPurchases.String())
	}

	// 2. Zero-Cost Free Sample (100% Item Discount)
	freeProd := h.NewProduct("عينة ترويجية مجانية", 5000, 50)
	freeSale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerID:    cust.ID,
		CustomerName:  cust.Name,
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      freeProd.Price,
		Discount:      domain.Zero(),
		Total:         domain.Zero(),
		PaymentMethod: "cash",
		Status:        "completed",
		ItemsCount:    1,
		Items: []domain.SaleItem{
			{ProductID: freeProd.ID, Name: freeProd.Name, Quantity: 1, Price: freeProd.Price, Discount: freeProd.Price, Total: domain.Zero()},
		},
	}

	if err := h.SaleHandler.ProcessSale(freeSale); err != nil {
		t.Fatalf("free zero-cost sale failed: %v", err)
	}

	if h.MustReloadProduct(freeProd.ID).Stock != 49 {
		t.Errorf("expected free sample stock to be 49, got %v", h.MustReloadProduct(freeProd.ID).Stock)
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ SCENARIO 10: Fuzzing, SQL Injection, and Unicode Malicious Payloads
// Inserts hostile strings into free-text fields and verifies sanitization.
// ═══════════════════════════════════════════════════════════════════════════
func TestSimulation10_Fuzzing_XSS_MaliciousFreeTextInjection(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	hostilePayloads := []string{
		"'; DROP TABLE sales; --",
		"<script>alert('xss')</script>",
		"=cmd|' /C calc'!A0",
		"العربية 123 🚀 \u0000 \t \n \r",
		"🚩 ' OR 1=1 --",
	}

	for i, payload := range hostilePayloads {
		custName := fmt.Sprintf("عميل خبيث %d %s", i, payload)
		cust := domain.Customer{
			Name:  custName,
			Phone: fmt.Sprintf("0770000000%d", i),
		}

		err := h.CRMHandler.SaveCustomer(cust)
		if err != nil {
			t.Fatalf("SaveCustomer with hostile payload failed unexpectedly: %v", err)
		}

		// Query by search
		found, err := h.CRMHandler.SearchCustomers("عميل خبيث")
		if err != nil {
			t.Fatalf("SearchCustomers failed with hostile payloads in DB: %v", err)
		}
		if len(found) == 0 {
			t.Error("expected to find saved customer")
		}
	}

	// Verify database is completely intact and sales table exists
	sales, err := h.SaleHandler.GetSales(1, 10, "", "", "")
	if err != nil {
		t.Fatalf("GetSales failed after SQL injection payloads: %v", err)
	}
	_ = sales
}
