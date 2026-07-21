package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
	"context"
)

type PaymentHandler struct {
	ctx            context.Context
	paymentService domain.PaymentService
}

func NewPaymentHandler(paymentService domain.PaymentService) *PaymentHandler {
	return &PaymentHandler{
		paymentService: paymentService,
	}
}

func (h *PaymentHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *PaymentHandler) CreatePayment(payment domain.Payment) (*domain.Payment, error) {
	if err := auth.RequirePermission(auth.PermSales); err != nil {
		return nil, err
	}
	return h.paymentService.CreatePayment(payment)
}

func (h *PaymentHandler) GetPaymentsBySale(saleID string) ([]domain.Payment, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.paymentService.GetPaymentsBySale(saleID)
}

func (h *PaymentHandler) GetPaymentsByCustomer(customerID string) ([]domain.Payment, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.paymentService.GetPaymentsByCustomer(customerID)
}

func (h *PaymentHandler) DeletePayment(id uint) error {
	if err := auth.RequirePermission(auth.PermDeleteSales); err != nil {
		return err
	}
	return h.paymentService.DeletePayment(id)
}

func (h *PaymentHandler) PayInstallment(saleID string, installmentIndex int, amount domain.Amount, method string) error {
	if err := auth.RequirePermission(auth.PermSales); err != nil {
		return err
	}
	return h.paymentService.PayInstallment(saleID, installmentIndex, amount, method)
}

func (h *PaymentHandler) GetCustomerInstallments(customerID string) ([]domain.Sale, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.paymentService.GetCustomerInstallments(customerID)
}

type InstallmentSummaryResult struct {
	Total     int           `json:"total"`
	Paid      int           `json:"paid"`
	Remaining domain.Amount `json:"remaining"`
}

func (h *PaymentHandler) GetInstallmentSummary(saleID string) (*InstallmentSummaryResult, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	total, paid, remaining, err := h.paymentService.GetInstallmentSummary(saleID)
	if err != nil {
		return nil, err
	}
	return &InstallmentSummaryResult{
		Total:     total,
		Paid:      paid,
		Remaining: remaining,
	}, nil
}

func (h *PaymentHandler) CalculateInstallmentPlan(total, downPayment domain.Amount, months int) (*domain.InstallmentPlan, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.paymentService.CalculateInstallmentPlan(total, downPayment, months)
}

// GetInstallmentAlertSummary calculates overdue installments metrics (backward-compatible wrapper)
func (h *PaymentHandler) GetInstallmentAlertSummary() (map[string]interface{}, error) {
	if err := auth.RequirePermission(auth.PermReports); err != nil {
		return nil, err
	}
	summary, err := h.paymentService.GetInstallmentAlertSummary()
	if err != nil {
		return nil, err
	}

	// Map domain.InstallmentAlertSummary to the exact structure the frontend expects
	type InstallmentAlertCompatible struct {
		SaleID        string  `json:"saleId"`
		CustomerID    string  `json:"customerId"`
		CustomerName  string  `json:"customerName"`
		CustomerPhone string  `json:"customerPhone"`
		InstNumber    int     `json:"instNumber"`
		DueDate       string  `json:"dueDate"`
		Amount        float64 `json:"amount"` // float64 for frontend compatibility
		DaysOverdue   int     `json:"daysOverdue"`
		TotalDue      float64 `json:"totalDue"` // float64 for frontend compatibility
	}

	type TopCustomerCompatible struct {
		CustomerID   string  `json:"customerId"`
		CustomerName string  `json:"customerName"`
		TotalDebt    float64 `json:"totalDebt"` // float64 for frontend compatibility
		OverdueCount int     `json:"overdueCount"`
	}

	alerts := make([]InstallmentAlertCompatible, len(summary.Alerts))
	for i, alert := range summary.Alerts {
		alerts[i] = InstallmentAlertCompatible{
			SaleID:        alert.SaleID,
			CustomerID:    alert.CustomerID,
			CustomerName:  alert.CustomerName,
			CustomerPhone: alert.CustomerPhone,
			InstNumber:    alert.InstNumber,
			DueDate:       alert.DueDate,
			Amount:        alert.Amount.Float(),
			DaysOverdue:   alert.DaysOverdue,
			TotalDue:      alert.TotalDue.Float(),
		}
	}

	topCustomers := make([]TopCustomerCompatible, len(summary.TopCustomers))
	for i, customer := range summary.TopCustomers {
		topCustomers[i] = TopCustomerCompatible{
			CustomerID:   customer.CustomerID,
			CustomerName: customer.CustomerName,
			TotalDebt:    customer.TotalDebt.Float(),
			OverdueCount: customer.OverdueCount,
		}
	}

	return map[string]interface{}{
		"totalOverdue": summary.TotalOverdue,
		"totalAmount":  summary.TotalAmount.Float(),
		"byDay":        summary.ByDay,
		"topCustomers": topCustomers,
		"alerts":       alerts,
	}, nil
}
