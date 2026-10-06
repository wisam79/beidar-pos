package handlers

import (
	"strings"
	"testing"

	"beidar-desktop/internal/core/domain"
)

// clientModeLan returns a LAN double already in client mode so the handlers
// route every read/write through the remote REST wrappers instead of the local
// service layer.
func clientModeLan() *fakeLanService {
	lan := newFakeLan()
	lan.clientMode = true
	return lan
}

// A non-nil service error proves whether the local service layer was reached:
// in client mode it must stay untouched, so the call has to succeed.

func TestProductHandler_ClientModeRoutesRemotely(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeProductService{err: errBoom}
	lan := clientModeLan()
	lan.onGet = func(endpoint string, out interface{}) {
		if target, ok := out.(*[]domain.Product); ok {
			*target = []domain.Product{{ID: "remote"}}
		}
	}
	h := NewProductHandler(svc, lan)

	if got, err := h.GetAllProducts(); err != nil {
		t.Fatalf("GetAllProducts in client mode: %v", err)
	} else if len(got) != 1 || got[0].ID != "remote" {
		t.Fatalf("expected remote products, got %v", got)
	}
	if _, err := h.GetProductByID("p1"); err != nil {
		t.Fatalf("GetProductByID in client mode: %v", err)
	}
	if err := h.CreateProduct(domain.Product{ID: "p1"}); err != nil {
		t.Fatalf("CreateProduct in client mode: %v", err)
	}
	if err := h.UpdateProduct(domain.Product{ID: "p1"}); err != nil {
		t.Fatalf("UpdateProduct in client mode: %v", err)
	}
	if err := h.DeleteProduct("p1"); err != nil {
		t.Fatalf("DeleteProduct in client mode: %v", err)
	}
	if _, err := h.SearchProducts("q"); err != nil {
		t.Fatalf("SearchProducts in client mode: %v", err)
	}
	if _, err := h.GetStockMovements(); err != nil {
		t.Fatalf("GetStockMovements in client mode: %v", err)
	}
	if err := h.LogStockMovement("p1", "n", "in", 1, "r"); err != nil {
		t.Fatalf("LogStockMovement in client mode: %v", err)
	}

	if len(lan.postCalls) == 0 || len(lan.deleteCalls) == 0 {
		t.Fatal("expected remote POST/DELETE calls to be issued in client mode")
	}
}

func TestSaleHandler_ClientModeRoutesRemotely(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeSaleService{err: errBoom}
	lan := clientModeLan()
	lan.onGet = func(endpoint string, out interface{}) {
		switch target := out.(type) {
		case *domain.Sale:
			*target = domain.Sale{ID: "s1", Items: []domain.SaleItem{{ID: 1}}}
		case *domain.PaginatedSales:
			*target = domain.PaginatedSales{Total: 1}
		}
	}
	h := NewSaleHandler(svc, lan)

	if _, err := h.GetSales(1, 10, "search", "paid", "2026-10"); err != nil {
		t.Fatalf("GetSales in client mode: %v", err)
	}
	if len(lan.getCalls) != 1 || !strings.Contains(lan.getCalls[0], "/api/sales?") {
		t.Fatalf("unexpected sales endpoint: %v", lan.getCalls)
	}
	for _, want := range []string{"search=search", "status=paid", "date=2026-10", "page=1", "pageSize=10"} {
		if !strings.Contains(lan.getCalls[0], want) {
			t.Fatalf("endpoint %q is missing %q", lan.getCalls[0], want)
		}
	}

	if got, err := h.GetSale("s1"); err != nil || got == nil || got.ID != "s1" {
		t.Fatalf("GetSale in client mode = %v, %v", got, err)
	}
	if got, err := h.GetSaleItems("s1"); err != nil || len(got) != 1 {
		t.Fatalf("GetSaleItems in client mode = %v, %v", got, err)
	}
	if err := h.ProcessSale(domain.Sale{}); err != nil {
		t.Fatalf("ProcessSale in client mode: %v", err)
	}
	if err := h.ReturnSale("s1"); err != nil {
		t.Fatalf("ReturnSale in client mode: %v", err)
	}
	if err := h.ReturnSalePartial("s1", "p1", 1); err != nil {
		t.Fatalf("ReturnSalePartial in client mode: %v", err)
	}
	if err := h.DeleteSale("s1"); err != nil {
		t.Fatalf("DeleteSale in client mode: %v", err)
	}
}

func TestCRMHandler_ClientModeRoutesRemotely(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeCRMService{err: errBoom}
	lan := clientModeLan()
	lan.onGet = func(endpoint string, out interface{}) {
		switch target := out.(type) {
		case *[]domain.Customer:
			*target = []domain.Customer{
				{ID: "c1", Name: "Ahmed", Phone: "0500000000"},
				{ID: "c2", Name: "Sara", Notes: "vip"},
			}
		case *[]domain.Supplier:
			*target = []domain.Supplier{{ID: "s1"}}
		case *domain.PaginatedCustomers:
			*target = domain.PaginatedCustomers{Total: 2}
		case *domain.PaginatedSuppliers:
			*target = domain.PaginatedSuppliers{Total: 1}
		}
	}
	h := NewCRMHandler(svc, lan)

	if got, err := h.GetCustomers(); err != nil || len(got) != 2 {
		t.Fatalf("GetCustomers in client mode = %v, %v", got, err)
	}
	if got, err := h.GetCustomersPaged(1, 10, "نب"); err != nil || got == nil || got.Total != 2 {
		t.Fatalf("GetCustomersPaged in client mode = %v, %v", got, err)
	}
	if len(lan.getCalls) == 0 || !strings.Contains(lan.getCalls[len(lan.getCalls)-1], "search=") {
		t.Fatalf("paged endpoint must encode the search term: %v", lan.getCalls)
	}
	// The remote server has no search endpoint: filtering happens locally.
	matched, err := h.SearchCustomers("ahmed")
	if err != nil {
		t.Fatalf("SearchCustomers in client mode: %v", err)
	}
	if len(matched) != 1 || matched[0].ID != "c1" {
		t.Fatalf("client-side customer filtering failed: %v", matched)
	}
	if got, err := h.SearchCustomers("vip"); err != nil || len(got) != 1 || got[0].ID != "c2" {
		t.Fatalf("notes should be searched too: %v, %v", got, err)
	}
	if got, err := h.GetSuppliers(); err != nil || len(got) != 1 {
		t.Fatalf("GetSuppliers in client mode = %v, %v", got, err)
	}
	if got, err := h.GetSuppliersPaged(1, 10, ""); err != nil || got == nil {
		t.Fatalf("GetSuppliersPaged in client mode = %v, %v", got, err)
	}
	if err := h.SaveCustomer(domain.Customer{}); err != nil {
		t.Fatalf("SaveCustomer in client mode: %v", err)
	}
	if err := h.DeleteCustomer("c1", false); err != nil {
		t.Fatalf("DeleteCustomer in client mode: %v", err)
	}
	if err := h.SaveSupplier(domain.Supplier{}); err != nil {
		t.Fatalf("SaveSupplier in client mode: %v", err)
	}
	if err := h.DeleteSupplier("s1", false); err != nil {
		t.Fatalf("DeleteSupplier in client mode: %v", err)
	}
}

func TestDiscountHandler_ClientModeRoutesRemotely(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeDiscountService{err: errBoom}
	lan := clientModeLan()
	lan.onGet = func(endpoint string, out interface{}) {
		if target, ok := out.(*domain.Discount); ok {
			*target = domain.Discount{ID: "d1"}
		}
	}
	h := NewDiscountHandler(svc, lan)

	if _, err := h.GetAllDiscounts(); err != nil {
		t.Fatalf("GetAllDiscounts in client mode: %v", err)
	}
	if _, err := h.GetActiveDiscounts(); err != nil {
		t.Fatalf("GetActiveDiscounts in client mode: %v", err)
	}
	if got, err := h.GetDiscount("d1"); err != nil || got.ID != "d1" {
		t.Fatalf("GetDiscount in client mode = %v, %v", got, err)
	}
	if got, err := h.CreateDiscount(domain.Discount{}); err != nil || got.ID != "d1" {
		t.Fatalf("CreateDiscount in client mode = %v, %v", got, err)
	}
	if err := h.UpdateDiscount(domain.Discount{}); err != nil {
		t.Fatalf("UpdateDiscount in client mode: %v", err)
	}
	if err := h.ToggleDiscountStatus("d1"); err != nil {
		t.Fatalf("ToggleDiscountStatus in client mode: %v", err)
	}
	if err := h.DeleteDiscount("d1"); err != nil {
		t.Fatalf("DeleteDiscount in client mode: %v", err)
	}
	if got, err := h.ValidateCoupon("code"); err != nil || got.ID != "d1" {
		t.Fatalf("ValidateCoupon in client mode = %v, %v", got, err)
	}
	if err := h.ApplyDiscount("d1"); err != nil {
		t.Fatalf("ApplyDiscount in client mode: %v", err)
	}
}

func TestFinanceHandler_ClientModeRoutesRemotely(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeFinanceService{err: errBoom}
	lan := clientModeLan()
	lan.onGet = func(endpoint string, out interface{}) {
		switch target := out.(type) {
		case *[]domain.Expense:
			*target = []domain.Expense{{ID: "e1"}}
		case *[]domain.Category:
			*target = []domain.Category{{ID: "c1"}}
		case *domain.AppPreferences:
			*target = domain.AppPreferences{}
		}
	}
	h := NewFinanceHandler(svc, lan, &fakeBackupService{}, newFakeCloud())

	if got, err := h.GetExpenses("2026-10"); err != nil || len(got) != 1 {
		t.Fatalf("GetExpenses in client mode = %v, %v", got, err)
	}
	if len(lan.getCalls) == 0 || !strings.Contains(lan.getCalls[0], "?month=2026-10") {
		t.Fatalf("expense month filter not encoded: %v", lan.getCalls)
	}
	if got, err := h.GetCategories(); err != nil || len(got) != 1 {
		t.Fatalf("GetCategories in client mode = %v, %v", got, err)
	}
	if got, err := h.GetPreferences(); err != nil || got == nil {
		t.Fatalf("GetPreferences in client mode = %v, %v", got, err)
	}
	if err := h.SaveExpense(domain.Expense{}); err != nil {
		t.Fatalf("SaveExpense in client mode: %v", err)
	}
	if err := h.DeleteExpense("e1"); err != nil {
		t.Fatalf("DeleteExpense in client mode: %v", err)
	}
	if err := h.SaveCategory(domain.Category{}); err != nil {
		t.Fatalf("SaveCategory in client mode: %v", err)
	}
	if err := h.DeleteCategory("c1", false); err != nil {
		t.Fatalf("DeleteCategory in client mode: %v", err)
	}
	if err := h.UpdatePreferences(domain.AppPreferences{}); err != nil {
		t.Fatalf("UpdatePreferences in client mode: %v", err)
	}
}

func TestStatsHandler_ClientModeRoutesRemotely(t *testing.T) {
	seedAdminSession(t)
	svc := &fakeStatsService{err: errBoom}
	lan := clientModeLan()
	lan.onGet = func(endpoint string, out interface{}) {
		switch target := out.(type) {
		case *domain.DashboardStats:
			*target = domain.DashboardStats{TotalOrders: 3}
		case *domain.MonthlyComparison:
			*target = domain.MonthlyComparison{}
		}
	}
	h := NewStatsHandler(svc, lan)

	stats, err := h.GetDashboardStats("week")
	if err != nil || stats == nil || stats.TotalOrders != 3 {
		t.Fatalf("GetDashboardStats in client mode = %v, %v", stats, err)
	}
	if len(lan.getCalls) == 0 || !strings.Contains(lan.getCalls[0], "range=week") {
		t.Fatalf("stats range not encoded: %v", lan.getCalls)
	}
	if _, err := h.GetMonthlyComparison(); err != nil {
		t.Fatalf("GetMonthlyComparison in client mode: %v", err)
	}
}

// TestHandlers_SurfaceRemoteErrors proves that a failing LAN link is reported to
// the caller instead of being silently swallowed.
func TestHandlers_SurfaceRemoteErrors(t *testing.T) {
	seedAdminSession(t)
	lan := clientModeLan()
	lan.remoteGetErr = errBoom
	lan.remotePostErr = errBoom
	lan.remoteDeleteErr = errBoom

	if _, err := NewProductHandler(&fakeProductService{}, lan).GetAllProducts(); err == nil {
		t.Fatal("remote GET failure must propagate")
	}
	if err := NewProductHandler(&fakeProductService{}, lan).CreateProduct(domain.Product{}); err == nil {
		t.Fatal("remote POST failure must propagate")
	}
	if err := NewProductHandler(&fakeProductService{}, lan).DeleteProduct("p1"); err == nil {
		t.Fatal("remote DELETE failure must propagate")
	}
	if _, err := NewSaleHandler(&fakeSaleService{}, lan).GetSales(1, 10, "", "", ""); err == nil {
		t.Fatal("remote sales read failure must propagate")
	}
	if _, err := NewCRMHandler(&fakeCRMService{}, lan).GetCustomers(); err == nil {
		t.Fatal("remote customer read failure must propagate")
	}
	if err := NewDiscountHandler(&fakeDiscountService{}, lan).UpdateDiscount(domain.Discount{}); err == nil {
		t.Fatal("remote discount write failure must propagate")
	}
	if _, err := NewStatsHandler(&fakeStatsService{}, lan).GetDashboardStats("today"); err == nil {
		t.Fatal("remote stats read failure must propagate")
	}
}
