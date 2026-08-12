package domain

import (
	"fmt"
	"testing"
)

func TestFinancialLogic_TaxCalculations(t *testing.T) {
	tests := []struct {
		name       string
		basePrice  float64
		taxRate    float64
		expected   int64
		expectedTx int64
	}{
		{"Standard 15% Tax", 100.0, 15.0, 11500, 1500},
		{"Zero Tax", 100.0, 0.0, 10000, 0},
		{"High Tax", 100.0, 100.0, 20000, 10000},
		{"Fractional Tax Rate", 100.0, 15.5, 11550, 1550},
		{"Small Amount Tax", 0.99, 15.0, 114, 15},     
		{"Large Amount Tax", 99999.99, 15.0, 11499999, 1500000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			baseAmount, _ := ParseAmount(fmt.Sprintf("%.2f", tt.basePrice))
			taxAmount := baseAmount.Percentage(tt.taxRate)
			totalAmount := baseAmount.Add(taxAmount)

			if taxAmount.Cents() != tt.expectedTx {
				t.Errorf("expected tax %d, got %d", tt.expectedTx, taxAmount.Cents())
			}
			if totalAmount.Cents() != tt.expected {
				t.Errorf("expected total %d, got %d", tt.expected, totalAmount.Cents())
			}
		})
	}
}

func TestFinancialLogic_DiscountStacking(t *testing.T) {
	tests := []struct {
		name         string
		basePrice    float64
		discountPct1 float64
		discountPct2 float64
		discountFix  float64
		expected     int64
	}{
		{"Double Percentage", 100.0, 10.0, 10.0, 0.0, 8100}, 
		{"Percent then Fixed", 100.0, 10.0, 0.0, 10.0, 8000}, 
		{"Fixed then Percent", 100.0, 0.0, 10.0, 10.0, 8100}, 
		{"Max Discount (Free)", 100.0, 100.0, 10.0, 50.0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			amount, _ := ParseAmount(fmt.Sprintf("%.2f", tt.basePrice))
			
			if tt.discountPct1 > 0 {
				amount = amount.Sub(amount.Percentage(tt.discountPct1))
			}
			if tt.discountFix > 0 {
				fixed, _ := ParseAmount(fmt.Sprintf("%.2f", tt.discountFix))
				amount = amount.Sub(fixed)
			}
			if tt.discountPct2 > 0 {
				amount = amount.Sub(amount.Percentage(tt.discountPct2))
			}

			if amount.Cents() < 0 {
				amount = NewAmount(0)
			}

			if amount.Cents() != tt.expected {
				t.Errorf("expected final amount %d, got %d", tt.expected, amount.Cents())
			}
		})
	}
}

func TestFinancialLogic_SplitPaymentsPrecision(t *testing.T) {
	tests := []struct {
		name          string
		total         float64
		cashPayment   float64
		cardPayment   float64
		expectedDebt  int64
		expectError   bool
	}{
		{"Exact Split", 100.0, 50.0, 50.0, 0, false},
		{"Partial Payment (Debt)", 100.0, 20.0, 30.0, 5000, false},
		{"Overpayment", 100.0, 60.0, 50.0, -1000, false}, 
		{"Zero Payments", 100.0, 0.0, 0.0, 10000, false},
		{"Micro Cents Differences", 10.12, 10.0, 0.12, 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			total, _ := ParseAmount(fmt.Sprintf("%.2f", tt.total))
			cash, _ := ParseAmount(fmt.Sprintf("%.2f", tt.cashPayment))
			card, _ := ParseAmount(fmt.Sprintf("%.2f", tt.cardPayment))

			paid := cash.Add(card)
			debt := total.Sub(paid)

			if debt.Cents() != tt.expectedDebt {
				t.Errorf("expected debt %d, got %d", tt.expectedDebt, debt.Cents())
			}
		})
	}
}

func TestBusinessLogic_RoleAuthorization(t *testing.T) {
	type Action string
	const (
		ActionDeleteSale  Action = "DeleteSale"
		ActionProcessSale Action = "ProcessSale"
		ActionViewReports Action = "ViewReports"
	)

	hasAccess := func(role Role, action Action) bool {
		switch role {
		case RoleAdmin, RoleManager:
			return true 
		case RoleCashier:
			if action == ActionProcessSale {
				return true
			}
			return false
		default:
			return false
		}
	}

	tests := []struct {
		role   Role
		action Action
		want   bool
	}{
		{RoleAdmin, ActionDeleteSale, true},
		{RoleAdmin, ActionViewReports, true},
		{RoleManager, ActionDeleteSale, true},
		{RoleCashier, ActionDeleteSale, false},
		{RoleCashier, ActionProcessSale, true},
		{RoleCashier, ActionViewReports, false},
		{RoleViewer, ActionProcessSale, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.role)+"-"+string(tt.action), func(t *testing.T) {
			if got := hasAccess(tt.role, tt.action); got != tt.want {
				t.Errorf("hasAccess(%v, %v) = %v, want %v", tt.role, tt.action, got, tt.want)
			}
		})
	}
}
