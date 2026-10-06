package handlers

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
)

func TestAIHandler_DelegatesWithSession(t *testing.T) {
	seedAdminSession(t)
	ai := &fakeAIService{}
	h := NewAIHandler(ai)

	if err := h.AI_GenerateStream("hello"); err != nil {
		t.Fatalf("AI_GenerateStream: %v", err)
	}
	h.AI_CancelStream()
	if ai.cancelCall != 1 {
		t.Fatalf("expected the stream to be cancelled once, got %d", ai.cancelCall)
	}
}

func TestStatsHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeStatsService{
		dashboard: &domain.DashboardStats{TotalOrders: 7},
		monthly:   &domain.MonthlyComparison{},
	}
	h := NewStatsHandler(svc, newFakeLan())

	stats, err := h.GetDashboardStats("today")
	if err != nil {
		t.Fatalf("GetDashboardStats: %v", err)
	}
	if stats == nil || stats.TotalOrders != 7 {
		t.Fatalf("dashboard stats not delegated: %+v", stats)
	}
	if _, err := h.GetMonthlyComparison(); err != nil {
		t.Fatalf("GetMonthlyComparison: %v", err)
	}
}

func TestPrintHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakePrintService{
		qr:       "base64-qr",
		printers: []domain.PrinterInfo{{Name: "HP"}},
		printer:  "HP",
	}
	h := NewPrintHandler(svc)

	if got, err := h.GenerateQRCode("data", 32); err != nil || got != "base64-qr" {
		t.Fatalf("GenerateQRCode = %q, %v", got, err)
	}
	if got, err := h.GetAvailablePrinters(); err != nil || len(got) != 1 {
		t.Fatalf("GetAvailablePrinters = %v, %v", got, err)
	}
	if got, err := h.GetDefaultPrinter(); err != nil || got != "HP" {
		t.Fatalf("GetDefaultPrinter = %q, %v", got, err)
	}
	if err := h.TestPrinter("HP"); err != nil {
		t.Fatalf("TestPrinter: %v", err)
	}
	if err := h.PrintBitmapReceipt("HP", "b64"); err != nil {
		t.Fatalf("PrintBitmapReceipt: %v", err)
	}
}

func TestProductHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeProductService{
		products: []domain.Product{{ID: "p1"}},
		product:  &domain.Product{ID: "p1"},
		movement: []domain.StockMovement{{ID: 1}},
	}
	h := NewProductHandler(svc, newFakeLan())

	if got, err := h.GetAllProducts(); err != nil || len(got) != 1 {
		t.Fatalf("GetAllProducts = %v, %v", got, err)
	}
	if got, err := h.GetProductByID("p1"); err != nil || got == nil {
		t.Fatalf("GetProductByID = %v, %v", got, err)
	}
	if err := h.CreateProduct(domain.Product{ID: "p1"}); err != nil {
		t.Fatalf("CreateProduct: %v", err)
	}
	if err := h.UpdateProduct(domain.Product{ID: "p1"}); err != nil {
		t.Fatalf("UpdateProduct: %v", err)
	}
	if err := h.DeleteProduct("p1"); err != nil {
		t.Fatalf("DeleteProduct: %v", err)
	}
	if got, err := h.SearchProducts("p"); err != nil || len(got) != 1 {
		t.Fatalf("SearchProducts = %v, %v", got, err)
	}
	if got, err := h.GetStockMovements(); err != nil || len(got) != 1 {
		t.Fatalf("GetStockMovements = %v, %v", got, err)
	}
	if err := h.LogStockMovement("p1", "n", "in", 1, "r"); err != nil {
		t.Fatalf("LogStockMovement: %v", err)
	}
}

func TestCRMHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeCRMService{
		customers: []domain.Customer{{ID: "c1"}},
		suppliers: []domain.Supplier{{ID: "s1"}},
		custPage:  &domain.PaginatedCustomers{Total: 1},
		supPage:   &domain.PaginatedSuppliers{Total: 1},
	}
	h := NewCRMHandler(svc, newFakeLan())

	if got, err := h.GetCustomers(); err != nil || len(got) != 1 {
		t.Fatalf("GetCustomers = %v, %v", got, err)
	}
	if got, err := h.GetCustomersPaged(0, 0, "q"); err != nil || got == nil {
		t.Fatalf("GetCustomersPaged = %v, %v", got, err)
	}
	if got, err := h.SearchCustomers("q"); err != nil || len(got) != 1 {
		t.Fatalf("SearchCustomers = %v, %v", got, err)
	}
	if err := h.SaveCustomer(domain.Customer{ID: "c1"}); err != nil {
		t.Fatalf("SaveCustomer: %v", err)
	}
	if err := h.DeleteCustomer("c1", false); err != nil {
		t.Fatalf("DeleteCustomer: %v", err)
	}
	if got, err := h.GetSuppliers(); err != nil || len(got) != 1 {
		t.Fatalf("GetSuppliers = %v, %v", got, err)
	}
	if got, err := h.GetSuppliersPaged(0, 0, "q"); err != nil || got == nil {
		t.Fatalf("GetSuppliersPaged = %v, %v", got, err)
	}
	if err := h.SaveSupplier(domain.Supplier{ID: "s1"}); err != nil {
		t.Fatalf("SaveSupplier: %v", err)
	}
	if err := h.DeleteSupplier("s1", false); err != nil {
		t.Fatalf("DeleteSupplier: %v", err)
	}
}

func TestCRMHandler_PagedDefaults(t *testing.T) {
	seedAdminSession(t)
	h := NewCRMHandler(&fakeCRMService{custPage: &domain.PaginatedCustomers{}}, newFakeLan())
	// page < 1 and an out-of-range pageSize are normalised before delegation.
	if _, err := h.GetCustomersPaged(0, 9999, "q"); err != nil {
		t.Fatalf("GetCustomersPaged: %v", err)
	}
	if _, err := h.GetSuppliersPaged(-5, -1, "q"); err != nil {
		t.Fatalf("GetSuppliersPaged: %v", err)
	}
}

func TestSaleHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeSaleService{
		sales:    &domain.PaginatedSales{Total: 1},
		sale:     &domain.Sale{ID: "s1"},
		salesRaw: []domain.Sale{{ID: "s1"}},
		items:    []domain.SaleItem{{ID: 1}},
		parked:   &domain.ParkedSale{ID: 1},
		parkedL:  []domain.ParkedSale{{ID: 1}},
		count:    1,
	}
	h := NewSaleHandler(svc, newFakeLan())

	if got, err := h.GetSales(1, 10, "", "", ""); err != nil || got == nil {
		t.Fatalf("GetSales = %v, %v", got, err)
	}
	if got, err := h.GetSale("s1"); err != nil || got == nil {
		t.Fatalf("GetSale = %v, %v", got, err)
	}
	if err := h.ProcessSale(domain.Sale{ID: "s1"}); err != nil {
		t.Fatalf("ProcessSale: %v", err)
	}
	if err := h.ReturnSale("s1"); err != nil {
		t.Fatalf("ReturnSale: %v", err)
	}
	if err := h.ReturnSalePartial("s1", "p1", 1); err != nil {
		t.Fatalf("ReturnSalePartial: %v", err)
	}
	if got, err := h.GetSaleItems("s1"); err != nil || len(got) != 1 {
		t.Fatalf("GetSaleItems = %v, %v", got, err)
	}
	if err := h.DeleteSale("s1"); err != nil {
		t.Fatalf("DeleteSale: %v", err)
	}
	if got, err := h.ParkSale("[]", "n", "c", "", 0, 0); err != nil || got == nil {
		t.Fatalf("ParkSale = %v, %v", got, err)
	}
	if got, err := h.GetParkedSales(); err != nil || len(got) != 1 {
		t.Fatalf("GetParkedSales = %v, %v", got, err)
	}
	if got, err := h.GetParkedSalesCount(); err != nil || got != 1 {
		t.Fatalf("GetParkedSalesCount = %v, %v", got, err)
	}
	if got, err := h.RetrieveParkedSale(1); err != nil || got == nil {
		t.Fatalf("RetrieveParkedSale = %v, %v", got, err)
	}
	if err := h.DeleteParkedSale(1); err != nil {
		t.Fatalf("DeleteParkedSale: %v", err)
	}
	if got, err := h.GetInstallmentSales(); err != nil || len(got) != 1 {
		t.Fatalf("GetInstallmentSales = %v, %v", got, err)
	}
}

func TestPaymentHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakePaymentService{
		payment:   &domain.Payment{ID: 1},
		payments:  []domain.Payment{{ID: 1}},
		sales:     []domain.Sale{{ID: "s1"}},
		plan:      &domain.InstallmentPlan{},
		total:     3,
		paid:      1,
		remaining: 2000,
		summary: &domain.InstallmentAlertSummary{
			TotalOverdue: 1,
			TotalAmount:  5000,
			ByDay:        map[string]int64{"d1": 1},
			TopCustomers: []domain.OverdueCustomer{{CustomerID: "c1", CustomerName: "n", TotalDebt: 5000, OverdueCount: 1}},
			Alerts: []domain.InstallmentAlert{
				{SaleID: "s1", CustomerID: "c1", Amount: 5000, TotalDue: 5000, DaysOverdue: 3},
			},
		},
	}
	h := NewPaymentHandler(svc)

	if got, err := h.CreatePayment(domain.Payment{}); err != nil || got == nil {
		t.Fatalf("CreatePayment = %v, %v", got, err)
	}
	if err := h.CreatePaymentForced(domain.Payment{}); err != nil {
		t.Fatalf("CreatePaymentForced: %v", err)
	}
	if got, err := h.GetPaymentsBySale("s1"); err != nil || len(got) != 1 {
		t.Fatalf("GetPaymentsBySale = %v, %v", got, err)
	}
	if got, err := h.GetPaymentsByCustomer("c1"); err != nil || len(got) != 1 {
		t.Fatalf("GetPaymentsByCustomer = %v, %v", got, err)
	}
	if err := h.DeletePayment(1); err != nil {
		t.Fatalf("DeletePayment: %v", err)
	}
	if err := h.PayInstallment("s1", 0, 100, "cash"); err != nil {
		t.Fatalf("PayInstallment: %v", err)
	}
	if got, err := h.GetCustomerInstallments("c1"); err != nil || len(got) != 1 {
		t.Fatalf("GetCustomerInstallments = %v, %v", got, err)
	}
	summary, err := h.GetInstallmentSummary("s1")
	if err != nil {
		t.Fatalf("GetInstallmentSummary: %v", err)
	}
	if summary.Total != 3 || summary.Paid != 1 || summary.Remaining != 2000 {
		t.Fatalf("installment summary mismatch: %+v", summary)
	}
	if got, err := h.CalculateInstallmentPlan(10000, 0, 3); err != nil || got == nil {
		t.Fatalf("CalculateInstallmentPlan = %v, %v", got, err)
	}

	alerts, err := h.GetInstallmentAlertSummary()
	if err != nil {
		t.Fatalf("GetInstallmentAlertSummary: %v", err)
	}
	if alerts["totalOverdue"] != int64(1) {
		t.Fatalf("totalOverdue mismatch: %v", alerts["totalOverdue"])
	}
	if alerts["alerts"] == nil {
		t.Fatal("alerts payload missing from the alert summary")
	}
	if _, ok := alerts["topCustomers"]; !ok {
		t.Fatal("topCustomers missing from the alert payload")
	}
}

func TestFinanceHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeFinanceService{
		expenses: []domain.Expense{{ID: "e1"}},
		cats:     []domain.Category{{ID: "c1"}},
		prefs:    &domain.AppPreferences{},
		shift:    &domain.Shift{ID: "sh"},
		movement: &domain.CashMovement{ID: "m1"},
		order:    &domain.PurchaseOrder{ID: "o1"},
		orders:   []domain.PurchaseOrder{{ID: "o1"}},
		poStats:  &domain.PurchaseOrderStats{TotalOrders: 1},
		pinOK:    true,
	}
	backup := &fakeBackupService{result: &domain.BackupResult{}, count: 1}
	cloud := newFakeCloud()
	h := NewFinanceHandler(svc, newFakeLan(), backup, cloud)

	if got, err := h.GetExpenses("2026-10"); err != nil || len(got) != 1 {
		t.Fatalf("GetExpenses = %v, %v", got, err)
	}
	if err := h.SaveExpense(domain.Expense{}); err != nil {
		t.Fatalf("SaveExpense: %v", err)
	}
	if err := h.DeleteExpense("e1"); err != nil {
		t.Fatalf("DeleteExpense: %v", err)
	}
	if got, err := h.GetCategories(); err != nil || len(got) != 1 {
		t.Fatalf("GetCategories = %v, %v", got, err)
	}
	if err := h.SaveCategory(domain.Category{}); err != nil {
		t.Fatalf("SaveCategory: %v", err)
	}
	if err := h.DeleteCategory("c1", false); err != nil {
		t.Fatalf("DeleteCategory: %v", err)
	}
	if got, err := h.GetPreferences(); err != nil || got == nil {
		t.Fatalf("GetPreferences = %v, %v", got, err)
	}
	if err := h.UpdatePreferences(domain.AppPreferences{}); err != nil {
		t.Fatalf("UpdatePreferences: %v", err)
	}
	if ok, err := h.VerifyAdminPin("1234"); err != nil || !ok {
		t.Fatalf("VerifyAdminPin = %v, %v", ok, err)
	}
	if got, err := h.OpenShift("s", "n", 0); err != nil || got == nil {
		t.Fatalf("OpenShift = %v, %v", got, err)
	}
	if got, err := h.CloseShift("sh", 0, ""); err != nil || got == nil {
		t.Fatalf("CloseShift = %v, %v", got, err)
	}
	if got, err := h.GetActiveShift(); err != nil || got == nil {
		t.Fatalf("GetActiveShift = %v, %v", got, err)
	}
	if got, err := h.AddCashMovement("sh", "in", "r", "s", "n", 0); err != nil || got == nil {
		t.Fatalf("AddCashMovement = %v, %v", got, err)
	}
	if got, err := h.GetShiftMovements("sh"); err != nil || len(got) != 1 {
		t.Fatalf("GetShiftMovements = %v, %v", got, err)
	}
	if got, err := h.GetShiftHistory(10); err != nil || len(got) != 1 {
		t.Fatalf("GetShiftHistory = %v, %v", got, err)
	}
	if got, err := h.CreatePurchaseOrder(domain.PurchaseOrder{}); err != nil || got == nil {
		t.Fatalf("CreatePurchaseOrder = %v, %v", got, err)
	}
	if got, err := h.GetPurchaseOrders("", ""); err != nil || len(got) != 1 {
		t.Fatalf("GetPurchaseOrders = %v, %v", got, err)
	}
	if got, err := h.GetPurchaseOrder("o1"); err != nil || got == nil {
		t.Fatalf("GetPurchaseOrder = %v, %v", got, err)
	}
	if err := h.UpdatePurchaseOrder(domain.PurchaseOrder{}); err != nil {
		t.Fatalf("UpdatePurchaseOrder: %v", err)
	}
	if err := h.DeletePurchaseOrder("o1"); err != nil {
		t.Fatalf("DeletePurchaseOrder: %v", err)
	}
	if err := h.CancelPurchaseOrder("o1"); err != nil {
		t.Fatalf("CancelPurchaseOrder: %v", err)
	}
	if err := h.ReceivePurchaseOrder("o1", nil); err != nil {
		t.Fatalf("ReceivePurchaseOrder: %v", err)
	}
	if err := h.PayPurchaseOrder("o1", 100, "cash"); err != nil {
		t.Fatalf("PayPurchaseOrder: %v", err)
	}
	if got, err := h.GetPurchaseOrderStats(); err != nil || got == nil {
		t.Fatalf("GetPurchaseOrderStats = %v, %v", got, err)
	}
}

func TestFinanceHandler_UpdatePreferencesAdminPinRequiresAdmin(t *testing.T) {
	seedCashierSession(t, auth.PermSettings)
	h := NewFinanceHandler(&fakeFinanceService{prefs: &domain.AppPreferences{}}, newFakeLan(), nil, nil)
	if err := h.UpdatePreferences(domain.AppPreferences{AdminPin: "4321"}); err == nil {
		t.Fatal("setting a new admin PIN must require an admin session")
	}
	// The masked value is the "unchanged" sentinel and must pass through.
	if err := h.UpdatePreferences(domain.AppPreferences{AdminPin: "********"}); err != nil {
		t.Fatalf("masked PIN should pass the permission check: %v", err)
	}
}

func TestDiscountHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeDiscountService{
		discounts: []domain.Discount{{ID: "d1"}},
		discount:  &domain.Discount{ID: "d1"},
	}
	h := NewDiscountHandler(svc, newFakeLan())

	if got, err := h.GetAllDiscounts(); err != nil || len(got) != 1 {
		t.Fatalf("GetAllDiscounts = %v, %v", got, err)
	}
	if got, err := h.GetActiveDiscounts(); err != nil || len(got) != 1 {
		t.Fatalf("GetActiveDiscounts = %v, %v", got, err)
	}
	if got, err := h.GetDiscount("d1"); err != nil || got.ID != "d1" {
		t.Fatalf("GetDiscount = %v, %v", got, err)
	}
	if got, err := h.CreateDiscount(domain.Discount{}); err != nil || got.ID != "d1" {
		t.Fatalf("CreateDiscount = %v, %v", got, err)
	}
	if err := h.UpdateDiscount(domain.Discount{}); err != nil {
		t.Fatalf("UpdateDiscount: %v", err)
	}
	if err := h.DeleteDiscount("d1"); err != nil {
		t.Fatalf("DeleteDiscount: %v", err)
	}
	if err := h.ToggleDiscountStatus("d1"); err != nil {
		t.Fatalf("ToggleDiscountStatus: %v", err)
	}
	if got, err := h.ValidateCoupon("code"); err != nil || got.ID != "d1" {
		t.Fatalf("ValidateCoupon = %v, %v", got, err)
	}
	if err := h.ApplyDiscount("d1"); err != nil {
		t.Fatalf("ApplyDiscount: %v", err)
	}
}

func TestBackupHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeBackupService{
		result:   &domain.BackupResult{},
		backups:  []domain.BackupInfo{{}},
		count:    2,
		export:   &domain.DatabaseExport{},
		csv:      &domain.CSVExportResult{Filename: "p.csv"},
		imported: &domain.CSVImportResult{},
		template: "id,name",
		migrated: 5,
		stats:    &domain.ImageStorageStats{},
	}
	h := NewBackupHandler(svc)

	if got, err := h.CreateBackup(); err != nil || got == nil {
		t.Fatalf("CreateBackup = %v, %v", got, err)
	}
	if got, err := h.ListBackups(); err != nil || len(got) != 1 {
		t.Fatalf("ListBackups = %v, %v", got, err)
	}
	if err := h.RestoreBackup("p"); err != nil {
		t.Fatalf("RestoreBackup: %v", err)
	}
	if err := h.DeleteBackup("p"); err != nil {
		t.Fatalf("DeleteBackup: %v", err)
	}
	if got, err := h.CleanOldBackups(7); err != nil || got != 2 {
		t.Fatalf("CleanOldBackups = %v, %v", got, err)
	}
	if svc.lastClean != 7 {
		t.Fatalf("expected retention to reach the service, got %d", svc.lastClean)
	}
	if err := h.ResetDatabase(); err != nil {
		t.Fatalf("ResetDatabase: %v", err)
	}
	if got, err := h.ExportDatabase(); err != nil || got == nil {
		t.Fatalf("ExportDatabase = %v, %v", got, err)
	}
	if err := h.ImportDatabase(domain.DatabaseExport{}); err != nil {
		t.Fatalf("ImportDatabase: %v", err)
	}
	if got, err := h.ExportProductsCSV(); err != nil || got == nil {
		t.Fatalf("ExportProductsCSV = %v, %v", got, err)
	}
	if got, err := h.ImportProductsCSV("id,name", true); err != nil || got == nil {
		t.Fatalf("ImportProductsCSV = %v, %v", got, err)
	}
	if got := h.GetCSVTemplate(); got != "id,name" {
		t.Fatalf("GetCSVTemplate = %q", got)
	}
	if got, err := h.MigrateImagesToFilesystem(); err != nil || got != 5 {
		t.Fatalf("MigrateImagesToFilesystem = %v, %v", got, err)
	}
	if got, err := h.GetImageStorageStats(); err != nil || got == nil {
		t.Fatalf("GetImageStorageStats = %v, %v", got, err)
	}
}

func TestStaffHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	cloud := newFakeCloud()
	svc := &fakeStaffService{
		staff:   &domain.Staff{ID: "s1"},
		all:     []domain.Staff{{ID: "s1"}},
		allowed: true,
		count:   1,
		isDflt:  true,
	}
	h := NewStaffHandler(svc, cloud)

	if got, err := h.CreateStaff(domain.Staff{}, "pw"); err != nil || got == nil {
		t.Fatalf("CreateStaff = %v, %v", got, err)
	}
	if err := h.UpdateStaff(domain.Staff{}); err != nil {
		t.Fatalf("UpdateStaff: %v", err)
	}
	if err := h.UpdateStaffPassword("s1", "pw"); err != nil {
		t.Fatalf("UpdateStaffPassword: %v", err)
	}
	if err := h.DeleteStaff("s1", false); err != nil {
		t.Fatalf("DeleteStaff: %v", err)
	}
	if got, err := h.GetStaff("s1"); err != nil || got == nil {
		t.Fatalf("GetStaff = %v, %v", got, err)
	}
	if got, err := h.GetAllStaff(); err != nil || len(got) != 1 {
		t.Fatalf("GetAllStaff = %v, %v", got, err)
	}
	if got, err := h.GetActiveStaff(); err != nil || len(got) != 1 {
		t.Fatalf("GetActiveStaff = %v, %v", got, err)
	}
	if err := h.ToggleStaffStatus("s1"); err != nil {
		t.Fatalf("ToggleStaffStatus: %v", err)
	}
	if ok, err := h.HasPermission("s1", "x"); err != nil || !ok {
		t.Fatalf("HasPermission = %v, %v", ok, err)
	}
	if err := h.UpdateStaffPIN("s1", "1234"); err != nil {
		t.Fatalf("UpdateStaffPIN: %v", err)
	}
	if got, err := h.GetStaffCount(); err != nil || got != 1 {
		t.Fatalf("GetStaffCount = %v, %v", got, err)
	}
	if got, err := h.IsUsingDefaultPassword("s1"); err != nil || !got {
		t.Fatalf("IsUsingDefaultPassword = %v, %v", got, err)
	}
}

func TestStaffHandler_GetActiveStaffNeverNil(t *testing.T) {
	seedAdminSession(t)
	// A nil slice from the service must be normalised to an empty list so the
	// login screen never receives JSON null.
	h := NewStaffHandler(&fakeStaffService{all: nil}, newFakeCloud())
	got, err := h.GetActiveStaff()
	if err != nil {
		t.Fatalf("GetActiveStaff: %v", err)
	}
	if got == nil {
		t.Fatal("GetActiveStaff must return an empty slice, not nil")
	}
}

func TestStaffHandler_LoginActivatesSession(t *testing.T) {
	seedNoSession(t)
	cloud := newFakeCloud()
	svc := &fakeStaffService{
		result: &domain.AuthResult{
			Success:     true,
			Staff:       domain.Staff{ID: "s1", Role: domain.RoleCashier},
			Permissions: []string{domain.PermSales},
		},
	}
	h := NewStaffHandler(svc, cloud)

	res, err := h.AuthenticateByUsername("cashier", "pw")
	if err != nil {
		t.Fatalf("AuthenticateByUsername: %v", err)
	}
	if res == nil || !res.Success {
		t.Fatalf("expected a successful login, got %+v", res)
	}
	if !auth.IsActive() {
		t.Fatal("a successful login must activate the backend session")
	}
	if auth.CurrentStaffID() != "s1" {
		t.Fatalf("unexpected active staff: %q", auth.CurrentStaffID())
	}
	if cloud.keepAliveCall != 1 {
		t.Fatalf("expected the supabase session to be kept alive, got %d", cloud.keepAliveCall)
	}

	// PIN login follows the same contract.
	auth.Clear()
	if _, err := h.AuthenticateByPIN("1234"); err != nil {
		t.Fatalf("AuthenticateByPIN: %v", err)
	}
	if !auth.IsActive() {
		t.Fatal("a successful PIN login must activate the backend session")
	}

	// RestoreSession must only restore the currently active identity.
	if res, err := h.RestoreSession("s1"); err != nil || res == nil || !res.Success {
		t.Fatalf("RestoreSession = %+v, %v", res, err)
	}
	if res, err := h.RestoreSession("other"); err != nil || res == nil || res.Success {
		t.Fatalf("RestoreSession for another identity must be refused: %+v, %v", res, err)
	}
}

func TestStaffHandler_LoginFailureDoesNotActivateSession(t *testing.T) {
	seedNoSession(t)
	cloud := newFakeCloud()
	svc := &fakeStaffService{
		result: &domain.AuthResult{Success: false, Message: "بيانات غير صحيحة"},
	}
	h := NewStaffHandler(svc, cloud)

	if _, err := h.AuthenticateByPIN("0000"); err != nil {
		t.Fatalf("AuthenticateByPIN: %v", err)
	}
	if auth.IsActive() {
		t.Fatal("a failed login must not activate a session")
	}
	if cloud.keepAliveCall != 0 {
		t.Fatal("a failed login must not reach the cloud session")
	}
}

func TestSettingsHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeSettingsService{
		prefs:        &domain.AppPreferences{},
		update:       &domain.UpdateInfo{Version: "2.2.0", Checksum: "abc"},
		status:       domain.UpdateStatus{Info: &domain.UpdateInfo{Checksum: "abc"}},
		downloadPath: "/tmp/update.exe",
		crashReports: []string{"crash1.txt"},
		crashContent: "boom",
		aiKeys:       []string{"k1"},
		groqKeys:     []string{"g1"},
		deviceID:     "dev-1",
		autoStart:    true,
		pinOK:        true,
	}
	h := NewSettingsHandler(svc)

	if got, err := h.GetPreferences(); err != nil || got == nil {
		t.Fatalf("GetPreferences = %v, %v", got, err)
	}
	if err := h.UpdatePreferences(domain.AppPreferences{}); err != nil {
		t.Fatalf("UpdatePreferences: %v", err)
	}
	if !h.VerifyAdminPin("1234") {
		t.Fatal("VerifyAdminPin should delegate to the service")
	}
	if got, err := h.GetDeviceID(); err != nil || got != "dev-1" {
		t.Fatalf("GetDeviceID = %q, %v", got, err)
	}
	// The build version is injected with ldflags at release time, so only the
	// delegation itself is pinned here.
	_ = h.GetCurrentVersion()
	if got, err := h.CheckForUpdates(); err != nil || got == nil {
		t.Fatalf("CheckForUpdates = %v, %v", got, err)
	}
	if got := h.GetUpdateStatus(); got.Info == nil {
		t.Fatal("GetUpdateStatus should delegate")
	}
	if got, err := h.DownloadUpdate("http://example.com/u"); err != nil || got != "/tmp/update.exe" {
		t.Fatalf("DownloadUpdate = %q, %v", got, err)
	}
	if err := h.InstallUpdate("/tmp/update.exe"); err != nil {
		t.Fatalf("InstallUpdate: %v", err)
	}
	if err := h.SkipVersion("2.2.0"); err != nil {
		t.Fatalf("SkipVersion: %v", err)
	}
	if err := h.EnableAutoStart(); err != nil {
		t.Fatalf("EnableAutoStart: %v", err)
	}
	if err := h.DisableAutoStart(); err != nil {
		t.Fatalf("DisableAutoStart: %v", err)
	}
	if !h.IsAutoStartEnabled() {
		t.Fatal("IsAutoStartEnabled should delegate")
	}
	if got, err := h.GetCrashReports(); err != nil || len(got) != 1 {
		t.Fatalf("GetCrashReports = %v, %v", got, err)
	}
	if got, err := h.GetCrashReportContent("crash1.txt"); err != nil || got != "boom" {
		t.Fatalf("GetCrashReportContent = %q, %v", got, err)
	}
	if err := h.ClearCrashReports(); err != nil {
		t.Fatalf("ClearCrashReports: %v", err)
	}
	if got, err := h.FetchGlobalAIKeys(); err != nil || len(got) != 1 {
		t.Fatalf("FetchGlobalAIKeys = %v, %v", got, err)
	}
	if err := h.SaveGlobalAIKeys([]string{"k"}, "t"); err != nil {
		t.Fatalf("SaveGlobalAIKeys: %v", err)
	}
	if got, err := h.FetchGlobalGroqKeys(); err != nil || len(got) != 1 {
		t.Fatalf("FetchGlobalGroqKeys = %v, %v", got, err)
	}
	if err := h.SaveGlobalGroqKeys([]string{"g"}, "t"); err != nil {
		t.Fatalf("SaveGlobalGroqKeys: %v", err)
	}
	if got, err := h.GetBackupConfig(); err != nil || got == nil {
		t.Fatalf("GetBackupConfig = %v, %v", got, err)
	}
	if err := h.SetCloudAutoSync(true); err != nil {
		t.Fatalf("SetCloudAutoSync: %v", err)
	}
	if !svc.lastPrefs.CloudAutoSync {
		t.Fatal("SetCloudAutoSync must persist the flag through UpdatePreferences")
	}
}

func TestLanHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	lan := newFakeLan()
	h := NewLanHandler(lan)

	if err := h.StartLanServer(); err != nil {
		t.Fatalf("StartLanServer: %v", err)
	}
	if !lan.serverRunning {
		t.Fatal("StartLanServer should start the server")
	}
	if status := h.GetLanServerStatus(); !status.Running {
		t.Fatal("GetLanServerStatus should reflect the running server")
	}
	if err := h.StopLanServer(); err != nil {
		t.Fatalf("StopLanServer: %v", err)
	}
	if err := h.ConnectToLanServer("127.0.0.1", 9765, "secret"); err != nil {
		t.Fatalf("ConnectToLanServer: %v", err)
	}
	if !lan.clientMode {
		t.Fatal("ConnectToLanServer should switch the client into client mode")
	}
	if status := h.GetLanClientStatus(); !status.Connected {
		t.Fatal("GetLanClientStatus should reflect the connection")
	}
	if err := h.DisconnectFromLanServer(); err != nil {
		t.Fatalf("DisconnectFromLanServer: %v", err)
	}
	if _, err := h.GetLocalIP(); err != nil {
		// Interface enumeration can legitimately fail on a headless runner.
		t.Logf("GetLocalIP unavailable in this environment: %v", err)
	}
	if got, err := h.DiscoverServers(); err != nil || len(got) == 0 {
		t.Fatalf("DiscoverServers = %v, %v", got, err)
	}
	if got := h.TestLanConnection(); got == "" {
		t.Fatal("TestLanConnection should report a status string")
	}
	if secret, err := h.GenerateServerSecret(); err != nil || secret == "" {
		t.Fatalf("GenerateServerSecret = %q, %v", secret, err)
	}
	if secret, err := h.GetServerSecret(); err != nil || secret == "" {
		t.Fatalf("GetServerSecret = %q, %v", secret, err)
	}
	if got := h.GetConnectedClients(); len(got) != 1 {
		t.Fatalf("GetConnectedClients = %v", got)
	}
	if err := h.DisconnectLanClient("d1"); err != nil {
		t.Fatalf("DisconnectLanClient: %v", err)
	}
	if err := h.SuspendLanClient("d1"); err != nil {
		t.Fatalf("SuspendLanClient: %v", err)
	}
	if err := h.ResumeLanClient("d1"); err != nil {
		t.Fatalf("ResumeLanClient: %v", err)
	}
	if err := h.BlockLanDevice("d1", "n", "r"); err != nil {
		t.Fatalf("BlockLanDevice: %v", err)
	}
	if err := h.UnblockLanDevice(1); err != nil {
		t.Fatalf("UnblockLanDevice: %v", err)
	}
	if got, err := h.GetBlockedDevices(); err != nil || len(got) != 1 {
		t.Fatalf("GetBlockedDevices = %v, %v", got, err)
	}
}

func TestLanHandler_GetServerSecretMissing(t *testing.T) {
	seedAdminSession(t)
	h := NewLanHandler(&fakeLanService{serverSecret: ""})
	if _, err := h.GetServerSecret(); err == nil {
		t.Fatal("GetServerSecret must fail when the server secret is empty")
	}
}

func TestLanHandler_StartupBindsContext(t *testing.T) {
	lan := newFakeLan()
	h := NewLanHandler(lan)
	h.Startup(t.Context())
	// Startup must forward to the underlying service without panicking.
	if h.ctx == nil {
		t.Fatal("Startup should retain the context")
	}
}

func TestCloudHandler_Delegates(t *testing.T) {
	seedAdminSession(t)
	license := &domain.LicenseResult{}
	cloud := newFakeCloud()
	cloud.licenseResult = license
	cloud.storedKey = "KEY-1"
	cloud.currentUser = &domain.UserSession{Email: "a@b.c"}
	cloud.loggedIn = true
	cloud.googleConn = true
	cloud.zohoStatus = map[string]interface{}{"enabled": true}
	cloud.authURL = "https://auth"
	cloud.driveURL = "https://drive/f"
	cloud.authResult = &domain.SupabaseAuthResult{}
	cloud.validity = &domain.SessionValidityResult{Valid: true}
	cloud.cloudBackups = []domain.CloudBackup{{ID: "b1"}}
	h := NewCloudHandler(cloud)

	if err := h.SaveGoogleOAuthSecrets("id", "secret"); err != nil {
		t.Fatalf("SaveGoogleOAuthSecrets: %v", err)
	}
	if got, err := h.InitGoogleAuth(); err != nil || got != "https://auth" {
		t.Fatalf("InitGoogleAuth = %q, %v", got, err)
	}
	if err := h.CompleteGoogleAuth(); err != nil {
		t.Fatalf("CompleteGoogleAuth: %v", err)
	}
	if !h.IsGoogleConnected() {
		t.Fatal("IsGoogleConnected should delegate")
	}
	if err := h.DisconnectGoogle(); err != nil {
		t.Fatalf("DisconnectGoogle: %v", err)
	}
	if got, err := h.UploadBackupToDrive("f", "c"); err != nil || got != "https://drive/f" {
		t.Fatalf("UploadBackupToDrive = %q, %v", got, err)
	}
	if err := h.GoogleDriveBackupNow(); err != nil {
		t.Fatalf("GoogleDriveBackupNow: %v", err)
	}
	if got, err := h.Register("a@b.c", "pw", "store"); err != nil || got == nil {
		t.Fatalf("Register = %v, %v", got, err)
	}
	if got, err := h.Login("a@b.c", "pw"); err != nil || got == nil {
		t.Fatalf("Login = %v, %v", got, err)
	}
	if got, err := h.RecoverPassword("a@b.c"); err != nil || got == nil {
		t.Fatalf("RecoverPassword = %v, %v", got, err)
	}
	if err := h.DeleteCurrentUser(); err != nil {
		t.Fatalf("DeleteCurrentUser: %v", err)
	}
	if !h.IsLoggedIn() {
		t.Fatal("IsLoggedIn should delegate")
	}
	if got := h.GetCurrentUser(); got == nil || got.Email != "a@b.c" {
		t.Fatalf("GetCurrentUser = %v", got)
	}
	if got := h.CheckSessionValidity(); got == nil || !got.Valid {
		t.Fatalf("CheckSessionValidity = %v", got)
	}
	if err := h.CloudBackupNow(); err != nil {
		t.Fatalf("CloudBackupNow: %v", err)
	}
	if got, err := h.ListCloudBackupsForUser(); err != nil || len(got) != 1 {
		t.Fatalf("ListCloudBackupsForUser = %v, %v", got, err)
	}
	if err := h.DeleteCloudBackup("b1"); err != nil {
		t.Fatalf("DeleteCloudBackup: %v", err)
	}
	if err := h.RestoreCloudBackup("b1"); err != nil {
		t.Fatalf("RestoreCloudBackup: %v", err)
	}
	if err := h.SetupZohoIntegration("i", "s", "c"); err != nil {
		t.Fatalf("SetupZohoIntegration: %v", err)
	}
	if got := h.GetZohoStatus(); got["enabled"] != true {
		t.Fatalf("GetZohoStatus = %v", got)
	}
	if err := h.DisableZohoIntegration(); err != nil {
		t.Fatalf("DisableZohoIntegration: %v", err)
	}
	if got, err := h.VerifyLicense("KEY-1"); err != nil || got == nil {
		t.Fatalf("VerifyLicense = %v, %v", got, err)
	}
	if got, err := h.ActivateLicense("KEY-1"); err != nil || got == nil {
		t.Fatalf("ActivateLicense = %v, %v", got, err)
	}
	if got, err := h.GetCachedLicense(); err != nil || got == nil {
		t.Fatalf("GetCachedLicense = %v, %v", got, err)
	}
	if got, err := h.GetStoredLicenseKey(); err != nil || got != "KEY-1" {
		t.Fatalf("GetStoredLicenseKey = %q, %v", got, err)
	}
	if got, err := h.GetUserLicenseStatus(); err != nil || got == nil {
		t.Fatalf("GetUserLicenseStatus = %v, %v", got, err)
	}
	h.KeepAliveSupabase()
	if cloud.keepAliveCall != 1 {
		t.Fatal("KeepAliveSupabase should reach the cloud service")
	}

	// CloudHandler.Logout ends the *cloud* session only; the desktop staff
	// session is a separate principal and must survive it. Asserted last so the
	// rest of the test keeps its admin session.
	h.Logout()
	if cloud.logoutCalls != 1 {
		t.Fatal("Logout should reach the cloud service")
	}
	if !auth.IsActive() {
		t.Fatal("logging out of the cloud account must not end the local staff session")
	}
}

func TestCloudHandler_ListCloudBackupsNormalisesNil(t *testing.T) {
	seedAdminSession(t)
	cloud := newFakeCloud()
	cloud.cloudBackups = nil
	h := NewCloudHandler(cloud)

	got, err := h.ListCloudBackupsForUser()
	if err != nil {
		t.Fatalf("ListCloudBackupsForUser: %v", err)
	}
	if got == nil {
		t.Fatal("ListCloudBackupsForUser must return an empty slice, not nil")
	}
}
