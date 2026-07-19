package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/pkg/auth"
	"context"
)

type FinanceHandler struct {
	ctx            context.Context
	financeService domain.FinanceService
	lanService     network.LanService
}

func NewFinanceHandler(financeService domain.FinanceService, lanService network.LanService) *FinanceHandler {
	return &FinanceHandler{
		financeService: financeService,
		lanService:     lanService,
	}
}

func (h *FinanceHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *FinanceHandler) GetExpenses(month string) ([]domain.Expense, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result []domain.Expense
		path := "/api/expenses"
		if month != "" {
			path += "?month=" + month
		}
		err := h.lanService.RemoteGet(path, &result)
		return result, err
	}
	return h.financeService.GetExpenses(month)
}

func (h *FinanceHandler) SaveExpense(e domain.Expense) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/expenses", e, nil)
	}
	return h.financeService.SaveExpense(e)
}

func (h *FinanceHandler) DeleteExpense(id string) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemoteDelete("/api/expenses?id=" + id)
	}
	return h.financeService.DeleteExpense(id)
}

func (h *FinanceHandler) GetCategories() ([]domain.Category, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result []domain.Category
		err := h.lanService.RemoteGet("/api/categories", &result)
		return result, err
	}
	return h.financeService.GetCategories()
}

func (h *FinanceHandler) SaveCategory(c domain.Category) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/categories", c, nil)
	}
	return h.financeService.SaveCategory(c)
}

func (h *FinanceHandler) DeleteCategory(id string, force bool) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemoteDelete("/api/categories?id=" + id)
	}
	return h.financeService.DeleteCategory(id, force)
}

func (h *FinanceHandler) GetPreferences() (*domain.AppPreferences, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result domain.AppPreferences
		err := h.lanService.RemoteGet("/api/preferences", &result)
		return &result, err
	}
	return h.financeService.GetPreferences()
}

func (h *FinanceHandler) UpdatePreferences(newPrefs domain.AppPreferences) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/preferences", newPrefs, nil)
	}
	return h.financeService.UpdatePreferences(newPrefs)
}

func (h *FinanceHandler) VerifyAdminPin(pin string) (bool, error) {
	return h.financeService.VerifyAdminPin(pin)
}

func (h *FinanceHandler) OpenShift(staffID, staffName string, openingBalance domain.Amount) (*domain.Shift, error) {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return nil, err
	}
	return h.financeService.OpenShift(staffID, staffName, openingBalance)
}

func (h *FinanceHandler) CloseShift(shiftID string, closingBalance domain.Amount, note string) (*domain.Shift, error) {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return nil, err
	}
	return h.financeService.CloseShift(shiftID, closingBalance, note)
}

func (h *FinanceHandler) GetActiveShift() (*domain.Shift, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.financeService.GetActiveShift()
}

func (h *FinanceHandler) AddCashMovement(shiftID, moveType, reason, staffID, staffName string, amount domain.Amount) (*domain.CashMovement, error) {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return nil, err
	}
	return h.financeService.AddCashMovement(shiftID, moveType, reason, staffID, staffName, amount)
}

func (h *FinanceHandler) GetShiftMovements(shiftID string) ([]domain.CashMovement, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.financeService.GetShiftMovements(shiftID)
}

func (h *FinanceHandler) GetShiftHistory(limit int) ([]domain.Shift, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.financeService.GetShiftHistory(limit)
}

func (h *FinanceHandler) CreatePurchaseOrder(order domain.PurchaseOrder) (*domain.PurchaseOrder, error) {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return nil, err
	}
	return h.financeService.CreatePurchaseOrder(order)
}

func (h *FinanceHandler) GetPurchaseOrders(status string, supplierID string) ([]domain.PurchaseOrder, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.financeService.GetPurchaseOrders(status, supplierID)
}

func (h *FinanceHandler) GetPurchaseOrder(id string) (*domain.PurchaseOrder, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.financeService.GetPurchaseOrder(id)
}

func (h *FinanceHandler) UpdatePurchaseOrder(order domain.PurchaseOrder) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	return h.financeService.UpdatePurchaseOrder(order)
}

func (h *FinanceHandler) DeletePurchaseOrder(id string) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	return h.financeService.DeletePurchaseOrder(id)
}

func (h *FinanceHandler) CancelPurchaseOrder(id string) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	return h.financeService.CancelPurchaseOrder(id)
}

func (h *FinanceHandler) ReceivePurchaseOrder(orderID string, items []domain.PurchaseOrderItem) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	return h.financeService.ReceivePurchaseOrder(orderID, items)
}

func (h *FinanceHandler) PayPurchaseOrder(orderID string, amount domain.Amount, method string) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	return h.financeService.PayPurchaseOrder(orderID, amount, method)
}

func (h *FinanceHandler) GetPurchaseOrderStats() (*domain.PurchaseOrderStats, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.financeService.GetPurchaseOrderStats()
}
