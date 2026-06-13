package handlers

import (
	"beidar-desktop/internal/core/domain"
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
	return h.paymentService.CreatePayment(payment)
}

func (h *PaymentHandler) GetPaymentsBySale(saleID string) ([]domain.Payment, error) {
	return h.paymentService.GetPaymentsBySale(saleID)
}

func (h *PaymentHandler) GetPaymentsByCustomer(customerID string) ([]domain.Payment, error) {
	return h.paymentService.GetPaymentsByCustomer(customerID)
}

func (h *PaymentHandler) DeletePayment(id uint) error {
	return h.paymentService.DeletePayment(id)
}

func (h *PaymentHandler) PayInstallment(saleID string, installmentIndex int, amount float64, method string) error {
	return h.paymentService.PayInstallment(saleID, installmentIndex, domain.NewAmount(amount), method)
}

func (h *PaymentHandler) GetCustomerInstallments(customerID string) ([]domain.Sale, error) {
	return h.paymentService.GetCustomerInstallments(customerID)
}

type InstallmentSummaryResult struct {
	Total     int     `json:"total"`
	Paid      int     `json:"paid"`
	Remaining float64 `json:"remaining"`
}

func (h *PaymentHandler) GetInstallmentSummary(saleID string) (*InstallmentSummaryResult, error) {
	total, paid, remaining, err := h.paymentService.GetInstallmentSummary(saleID)
	if err != nil {
		return nil, err
	}
	return &InstallmentSummaryResult{
		Total:     total,
		Paid:      paid,
		Remaining: remaining.Float(),
	}, nil
}

func (h *PaymentHandler) CalculateInstallmentPlan(total, downPayment float64, months int) (*domain.InstallmentPlan, error) {
	return h.paymentService.CalculateInstallmentPlan(domain.NewAmount(total), domain.NewAmount(downPayment), months)
}

