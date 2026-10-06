package handlers

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
)

// guardCase is a single handler invocation normalised to its error result so
// that whole groups of guarded methods can be asserted in one table.
type guardCase struct {
	name string
	call func() error
}

// assertAllGuarded fails when any of the supplied calls stops rejecting an
// unauthenticated caller. Every guarded handler method must fail closed.
func assertAllGuarded(t *testing.T, cases []guardCase) {
	t.Helper()
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := c.call(); err == nil {
				t.Fatalf("%s: expected an auth error without a session", c.name)
			}
		})
	}
}

func TestStatsHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewStatsHandler(&fakeStatsService{}, newFakeLan())
	assertAllGuarded(t, []guardCase{
		{"GetDashboardStats", func() error { _, err := h.GetDashboardStats("today"); return err }},
		{"GetMonthlyComparison", func() error { _, err := h.GetMonthlyComparison(); return err }},
	})
}

func TestPrintHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewPrintHandler(&fakePrintService{})
	assertAllGuarded(t, []guardCase{
		{"GenerateQRCode", func() error { _, err := h.GenerateQRCode("data", 10); return err }},
		{"GetAvailablePrinters", func() error { _, err := h.GetAvailablePrinters(); return err }},
		{"GetDefaultPrinter", func() error { _, err := h.GetDefaultPrinter(); return err }},
		{"TestPrinter", func() error { return h.TestPrinter("printer") }},
		{"PrintBitmapReceipt", func() error { return h.PrintBitmapReceipt("printer", "b64") }},
	})
}

func TestProductHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewProductHandler(&fakeProductService{}, newFakeLan())
	assertAllGuarded(t, []guardCase{
		{"GetAllProducts", func() error { _, err := h.GetAllProducts(); return err }},
		{"GetProductByID", func() error { _, err := h.GetProductByID("p1"); return err }},
		{"CreateProduct", func() error { return h.CreateProduct(domain.Product{}) }},
		{"UpdateProduct", func() error { return h.UpdateProduct(domain.Product{}) }},
		{"DeleteProduct", func() error { return h.DeleteProduct("p1") }},
		{"SearchProducts", func() error { _, err := h.SearchProducts("q"); return err }},
		{"GetStockMovements", func() error { _, err := h.GetStockMovements(); return err }},
		{"LogStockMovement", func() error { return h.LogStockMovement("p1", "n", "in", 1, "r") }},
	})
}

func TestCRMHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewCRMHandler(&fakeCRMService{}, newFakeLan())
	assertAllGuarded(t, []guardCase{
		{"GetCustomers", func() error { _, err := h.GetCustomers(); return err }},
		{"GetCustomersPaged", func() error { _, err := h.GetCustomersPaged(1, 10, ""); return err }},
		{"SearchCustomers", func() error { _, err := h.SearchCustomers("q"); return err }},
		{"SaveCustomer", func() error { return h.SaveCustomer(domain.Customer{}) }},
		{"DeleteCustomer", func() error { return h.DeleteCustomer("c1", false) }},
		{"GetSuppliers", func() error { _, err := h.GetSuppliers(); return err }},
		{"GetSuppliersPaged", func() error { _, err := h.GetSuppliersPaged(1, 10, ""); return err }},
		{"SaveSupplier", func() error { return h.SaveSupplier(domain.Supplier{}) }},
		{"DeleteSupplier", func() error { return h.DeleteSupplier("s1", false) }},
	})
}

func TestSaleHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewSaleHandler(&fakeSaleService{}, newFakeLan())
	assertAllGuarded(t, []guardCase{
		{"GetSales", func() error { _, err := h.GetSales(1, 10, "", "", ""); return err }},
		{"GetSale", func() error { _, err := h.GetSale("s1"); return err }},
		{"ProcessSale", func() error { return h.ProcessSale(domain.Sale{}) }},
		{"ReturnSale", func() error { return h.ReturnSale("s1") }},
		{"ReturnSalePartial", func() error { return h.ReturnSalePartial("s1", "p1", 1) }},
		{"GetSaleItems", func() error { _, err := h.GetSaleItems("s1"); return err }},
		{"DeleteSale", func() error { return h.DeleteSale("s1") }},
		{"ParkSale", func() error { _, err := h.ParkSale("[]", "n", "c", "", 0, 0); return err }},
		{"GetParkedSales", func() error { _, err := h.GetParkedSales(); return err }},
		{"GetParkedSalesCount", func() error { _, err := h.GetParkedSalesCount(); return err }},
		{"RetrieveParkedSale", func() error { _, err := h.RetrieveParkedSale(1); return err }},
		{"DeleteParkedSale", func() error { return h.DeleteParkedSale(1) }},
		{"GetInstallmentSales", func() error { _, err := h.GetInstallmentSales(); return err }},
	})
}

func TestPaymentHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewPaymentHandler(&fakePaymentService{})
	assertAllGuarded(t, []guardCase{
		{"CreatePayment", func() error { _, err := h.CreatePayment(domain.Payment{}); return err }},
		{"CreatePaymentForced", func() error { return h.CreatePaymentForced(domain.Payment{}) }},
		{"GetPaymentsBySale", func() error { _, err := h.GetPaymentsBySale("s1"); return err }},
		{"GetPaymentsByCustomer", func() error { _, err := h.GetPaymentsByCustomer("c1"); return err }},
		{"DeletePayment", func() error { return h.DeletePayment(1) }},
		{"PayInstallment", func() error { return h.PayInstallment("s1", 0, 0, "cash") }},
		{"GetCustomerInstallments", func() error { _, err := h.GetCustomerInstallments("c1"); return err }},
		{"GetInstallmentSummary", func() error { _, err := h.GetInstallmentSummary("s1"); return err }},
		{"CalculateInstallmentPlan", func() error { _, err := h.CalculateInstallmentPlan(0, 0, 1); return err }},
		{"GetInstallmentAlertSummary", func() error { _, err := h.GetInstallmentAlertSummary(); return err }},
	})
}

func TestFinanceHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewFinanceHandler(&fakeFinanceService{}, newFakeLan(), &fakeBackupService{}, newFakeCloud())
	assertAllGuarded(t, []guardCase{
		{"GetExpenses", func() error { _, err := h.GetExpenses(""); return err }},
		{"SaveExpense", func() error { return h.SaveExpense(domain.Expense{}) }},
		{"DeleteExpense", func() error { return h.DeleteExpense("e1") }},
		{"GetCategories", func() error { _, err := h.GetCategories(); return err }},
		{"SaveCategory", func() error { return h.SaveCategory(domain.Category{}) }},
		{"DeleteCategory", func() error { return h.DeleteCategory("c1", false) }},
		{"GetPreferences", func() error { _, err := h.GetPreferences(); return err }},
		{"UpdatePreferences", func() error { return h.UpdatePreferences(domain.AppPreferences{}) }},
		{"VerifyAdminPin", func() error { _, err := h.VerifyAdminPin("1"); return err }},
		{"OpenShift", func() error { _, err := h.OpenShift("s", "n", 0); return err }},
		{"CloseShift", func() error { _, err := h.CloseShift("sh", 0, ""); return err }},
		{"GetActiveShift", func() error { _, err := h.GetActiveShift(); return err }},
		{"AddCashMovement", func() error { _, err := h.AddCashMovement("sh", "in", "r", "s", "n", 0); return err }},
		{"GetShiftMovements", func() error { _, err := h.GetShiftMovements("sh"); return err }},
		{"GetShiftHistory", func() error { _, err := h.GetShiftHistory(10); return err }},
		{"CreatePurchaseOrder", func() error { _, err := h.CreatePurchaseOrder(domain.PurchaseOrder{}); return err }},
		{"GetPurchaseOrders", func() error { _, err := h.GetPurchaseOrders("", ""); return err }},
		{"GetPurchaseOrder", func() error { _, err := h.GetPurchaseOrder("o1"); return err }},
		{"UpdatePurchaseOrder", func() error { return h.UpdatePurchaseOrder(domain.PurchaseOrder{}) }},
		{"DeletePurchaseOrder", func() error { return h.DeletePurchaseOrder("o1") }},
		{"CancelPurchaseOrder", func() error { return h.CancelPurchaseOrder("o1") }},
		{"ReceivePurchaseOrder", func() error { return h.ReceivePurchaseOrder("o1", nil) }},
		{"PayPurchaseOrder", func() error { return h.PayPurchaseOrder("o1", 0, "cash") }},
		{"GetPurchaseOrderStats", func() error { _, err := h.GetPurchaseOrderStats(); return err }},
	})
}

func TestDiscountHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewDiscountHandler(&fakeDiscountService{}, newFakeLan())
	assertAllGuarded(t, []guardCase{
		{"GetAllDiscounts", func() error { _, err := h.GetAllDiscounts(); return err }},
		{"GetActiveDiscounts", func() error { _, err := h.GetActiveDiscounts(); return err }},
		{"GetDiscount", func() error { _, err := h.GetDiscount("d1"); return err }},
		{"CreateDiscount", func() error { _, err := h.CreateDiscount(domain.Discount{}); return err }},
		{"UpdateDiscount", func() error { return h.UpdateDiscount(domain.Discount{}) }},
		{"DeleteDiscount", func() error { return h.DeleteDiscount("d1") }},
		{"ToggleDiscountStatus", func() error { return h.ToggleDiscountStatus("d1") }},
		{"ValidateCoupon", func() error { _, err := h.ValidateCoupon("code"); return err }},
		{"ApplyDiscount", func() error { return h.ApplyDiscount("d1") }},
	})
}

func TestLanHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewLanHandler(newFakeLan())
	assertAllGuarded(t, []guardCase{
		{"StartLanServer", func() error { return h.StartLanServer() }},
		{"StopLanServer", func() error { return h.StopLanServer() }},
		{"DisconnectFromLanServer", func() error { return h.DisconnectFromLanServer() }},
		{"GenerateServerSecret", func() error { _, err := h.GenerateServerSecret(); return err }},
		{"GetServerSecret", func() error { _, err := h.GetServerSecret(); return err }},
		{"DisconnectLanClient", func() error { return h.DisconnectLanClient("d1") }},
		{"SuspendLanClient", func() error { return h.SuspendLanClient("d1") }},
		{"ResumeLanClient", func() error { return h.ResumeLanClient("d1") }},
		{"BlockLanDevice", func() error { return h.BlockLanDevice("d1", "n", "r") }},
		{"UnblockLanDevice", func() error { return h.UnblockLanDevice(1) }},
	})
}

func TestBackupHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewBackupHandler(&fakeBackupService{})
	assertAllGuarded(t, []guardCase{
		{"CreateBackup", func() error { _, err := h.CreateBackup(); return err }},
		{"ListBackups", func() error { _, err := h.ListBackups(); return err }},
		{"RestoreBackup", func() error { return h.RestoreBackup("p") }},
		{"DeleteBackup", func() error { return h.DeleteBackup("p") }},
		{"CleanOldBackups", func() error { _, err := h.CleanOldBackups(7); return err }},
		{"ResetDatabase", func() error { return h.ResetDatabase() }},
		{"ExportDatabase", func() error { _, err := h.ExportDatabase(); return err }},
		{"ImportDatabase", func() error { return h.ImportDatabase(domain.DatabaseExport{}) }},
		{"ExportProductsCSV", func() error { _, err := h.ExportProductsCSV(); return err }},
		{"ImportProductsCSV", func() error { _, err := h.ImportProductsCSV("", false); return err }},
		{"MigrateImagesToFilesystem", func() error { _, err := h.MigrateImagesToFilesystem(); return err }},
		{"GetImageStorageStats", func() error { _, err := h.GetImageStorageStats(); return err }},
	})
}

func TestCloudHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	fake := newFakeCloud()
	fake.googleConn = true
	fake.loggedIn = true
	fake.currentUser = &domain.UserSession{Email: "a@b.c"}
	fake.zohoStatus = map[string]interface{}{"enabled": true}
	fake.keepAliveCall = 0
	h := NewCloudHandler(fake)

	assertAllGuarded(t, []guardCase{
		{"SaveGoogleOAuthSecrets", func() error { return h.SaveGoogleOAuthSecrets("id", "secret") }},
		{"InitGoogleAuth", func() error { _, err := h.InitGoogleAuth(); return err }},
		{"CompleteGoogleAuth", func() error { return h.CompleteGoogleAuth() }},
		{"DisconnectGoogle", func() error { return h.DisconnectGoogle() }},
		{"UploadBackupToDrive", func() error { _, err := h.UploadBackupToDrive("f", "c"); return err }},
		{"GoogleDriveBackupNow", func() error { return h.GoogleDriveBackupNow() }},
		{"DeleteCurrentUser", func() error { return h.DeleteCurrentUser() }},
		{"CloudBackupNow", func() error { return h.CloudBackupNow() }},
		{"ListCloudBackupsForUser", func() error { _, err := h.ListCloudBackupsForUser(); return err }},
		{"DeleteCloudBackup", func() error { return h.DeleteCloudBackup("b1") }},
		{"RestoreCloudBackup", func() error { return h.RestoreCloudBackup("b1") }},
		{"SetupZohoIntegration", func() error { return h.SetupZohoIntegration("i", "s", "c") }},
		{"DisableZohoIntegration", func() error { return h.DisableZohoIntegration() }},
		{"GetStoredLicenseKey", func() error { _, err := h.GetStoredLicenseKey(); return err }},
		{"GetUserLicenseStatus", func() error { _, err := h.GetUserLicenseStatus(); return err }},
	})

	// Methods that cannot return an error must still refuse to touch the
	// session-bound service and must not leak state to an unauthenticated caller.
	if h.IsGoogleConnected() {
		t.Fatal("IsGoogleConnected must report false without a session")
	}
	if h.IsLoggedIn() {
		t.Fatal("IsLoggedIn must report false without a session")
	}
	if h.GetCurrentUser() != nil {
		t.Fatal("GetCurrentUser must not leak the session user without auth")
	}
	status := h.GetZohoStatus()
	if enabled, _ := status["enabled"].(bool); enabled {
		t.Fatal("GetZohoStatus must report disabled without a session")
	}
	validity := h.CheckSessionValidity()
	if validity == nil || validity.Valid {
		t.Fatal("CheckSessionValidity must be invalid without a session")
	}
	h.KeepAliveSupabase()
	if fake.keepAliveCall != 0 {
		t.Fatal("KeepAliveSupabase must not reach the service without a session")
	}
}

func TestCloudHandler_LogoutIsIdempotentWhileOpen(t *testing.T) {
	fake := newFakeCloud()
	h := NewCloudHandler(fake)
	seedNoSession(t)

	// Logout must stay callable without a session (idempotent) and clear any
	// stale session so the next call cannot act on behalf of a previous user.
	h.Logout()
	if auth.IsActive() {
		t.Fatal("session must be inactive after Logout")
	}
}

func TestSettingsHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewSettingsHandler(&fakeSettingsService{})
	assertAllGuarded(t, []guardCase{
		{"GetPreferences", func() error { _, err := h.GetPreferences(); return err }},
		{"UpdatePreferences", func() error { return h.UpdatePreferences(domain.AppPreferences{}) }},
		{"DownloadUpdate", func() error { _, err := h.DownloadUpdate("u"); return err }},
		{"InstallUpdate", func() error { return h.InstallUpdate("p") }},
		{"SkipVersion", func() error { return h.SkipVersion("1.0.0") }},
		{"EnableAutoStart", func() error { return h.EnableAutoStart() }},
		{"DisableAutoStart", func() error { return h.DisableAutoStart() }},
		{"GetCrashReports", func() error { _, err := h.GetCrashReports(); return err }},
		{"GetCrashReportContent", func() error { _, err := h.GetCrashReportContent("f"); return err }},
		{"ClearCrashReports", func() error { return h.ClearCrashReports() }},
		{"FetchGlobalAIKeys", func() error { _, err := h.FetchGlobalAIKeys(); return err }},
		{"SaveGlobalAIKeys", func() error { return h.SaveGlobalAIKeys(nil, "t") }},
		{"FetchGlobalGroqKeys", func() error { _, err := h.FetchGlobalGroqKeys(); return err }},
		{"SaveGlobalGroqKeys", func() error { return h.SaveGlobalGroqKeys(nil, "t") }},
		{"GetBackupConfig", func() error { _, err := h.GetBackupConfig(); return err }},
		{"SetCloudAutoSync", func() error { return h.SetCloudAutoSync(true) }},
	})
	if h.VerifyAdminPin("1234") {
		t.Fatal("VerifyAdminPin must not succeed without a session")
	}
}

func TestStaffHandler_RequiresSession(t *testing.T) {
	seedNoSession(t)
	h := NewStaffHandler(&fakeStaffService{}, newFakeCloud())
	assertAllGuarded(t, []guardCase{
		{"CreateStaff", func() error { _, err := h.CreateStaff(domain.Staff{}, "pw"); return err }},
		{"UpdateStaff", func() error { return h.UpdateStaff(domain.Staff{}) }},
		{"UpdateStaffPassword", func() error { return h.UpdateStaffPassword("s1", "pw") }},
		{"DeleteStaff", func() error { return h.DeleteStaff("s1", false) }},
		{"GetStaff", func() error { _, err := h.GetStaff("s1"); return err }},
		{"GetAllStaff", func() error { _, err := h.GetAllStaff(); return err }},
		{"ToggleStaffStatus", func() error { return h.ToggleStaffStatus("s1") }},
		{"HasPermission", func() error { _, err := h.HasPermission("s1", "x"); return err }},
		{"UpdateStaffPIN", func() error { return h.UpdateStaffPIN("s1", "1234") }},
		{"GetStaffCount", func() error { _, err := h.GetStaffCount(); return err }},
		{"IsUsingDefaultPassword", func() error { _, err := h.IsUsingDefaultPassword("s1"); return err }},
	})

	// RestoreSession is a soft failure: it reports the missing session without
	// returning an error so the login UI can react.
	res, err := h.RestoreSession("s1")
	if err != nil {
		t.Fatalf("RestoreSession must not return an error without a session: %v", err)
	}
	if res == nil || res.Success {
		t.Fatalf("RestoreSession must report failure without a session, got %+v", res)
	}
}

// TestHandlers_RejectInsufficientPermission proves the guard is a real
// permission check, not just an authentication check: a cashier session with a
// narrow permission set must be refused by methods needing more.
func TestHandlers_RejectInsufficientPermission(t *testing.T) {
	seedCashierSession(t, auth.PermSales)

	product := NewProductHandler(&fakeProductService{}, newFakeLan())
	if err := product.CreateProduct(domain.Product{}); err == nil {
		t.Fatal("product creation must require the products permission")
	}

	staff := NewStaffHandler(&fakeStaffService{}, newFakeCloud())
	if _, err := staff.CreateStaff(domain.Staff{}, "pw"); err == nil {
		t.Fatal("staff management must require the staff permission")
	}

	backup := NewBackupHandler(&fakeBackupService{})
	if err := backup.ResetDatabase(); err == nil {
		t.Fatal("database reset must require admin")
	}

	settings := NewSettingsHandler(&fakeSettingsService{})
	if err := settings.UpdatePreferences(domain.AppPreferences{AdminPin: "1234"}); err == nil {
		t.Fatal("changing the admin PIN must require admin")
	}

	// A cashier with the sales permission may process a plain sale...
	if err := NewSaleHandler(&fakeSaleService{}, newFakeLan()).ProcessSale(domain.Sale{}); err != nil {
		t.Fatalf("cashier with sales permission should process a plain sale: %v", err)
	}
	// ...but any discount requires the dedicated permission.
	if err := NewSaleHandler(&fakeSaleService{}, newFakeLan()).ProcessSale(domain.Sale{Discount: 5}); err == nil {
		t.Fatal("a discounted sale must require the discounts permission")
	}
	if err := NewSaleHandler(&fakeSaleService{}, newFakeLan()).ProcessSale(domain.Sale{
		Items: []domain.SaleItem{{Discount: 5}},
	}); err == nil {
		t.Fatal("an item-level discount must require the discounts permission")
	}
}
