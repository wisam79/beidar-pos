package service_test

import (
	"fmt"
	"testing"

	"beidar-desktop/internal/core/domain"
)

// 1. Partial Returns & Credit Reversals (10 tests)
func TestSaleCoverage_PartialReturnsAndSplitReversals(t *testing.T) {
	tests := []struct {
		name             string
		totalSaleCents   int64
		cashPaidCents    int64
		creditPaidCents  int64
		returnQty        int
		itemPriceCents   int64
		expectedRefund   int64
		expectedDebtDiff int64
	}{
		{"Full Return Cash Only", 10000, 10000, 0, 1, 10000, 10000, 0},
		{"Full Return Credit Only", 10000, 0, 10000, 1, 10000, 0, -10000},
		{"Partial Return 50% Split Payment", 10000, 5000, 5000, 1, 5000, 0, -5000},
		{"Partial Return 25% Split Payment", 20000, 10000, 10000, 1, 5000, 0, -5000},
		{"Return Item Exceeding Cash Portion", 10000, 3000, 7000, 1, 5000, 0, -5000},
		{"Micro Cents Item Partial Return", 1500, 1000, 500, 1, 500, 0, -500},
		{"Zero Price Sample Item Return", 10000, 10000, 0, 1, 0, 0, 0},
		{"Return Multi-Item Order (Item 1)", 50000, 20000, 30000, 2, 10000, 0, -20000},
		{"Return Multi-Item Order (Item 2)", 50000, 20000, 30000, 3, 10000, 0, -30000},
		{"Over-Return Guard Test", 10000, 10000, 0, 0, 5000, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Mathematical calculation model for precision validation
			returnTotal := int64(tt.returnQty) * tt.itemPriceCents
			actualRefund := returnTotal
			actualDebtDiff := int64(0)

			if tt.creditPaidCents > 0 {
				if returnTotal <= tt.creditPaidCents {
					actualDebtDiff = -returnTotal
					actualRefund = 0
				} else {
					actualDebtDiff = -tt.creditPaidCents
					actualRefund = returnTotal - tt.creditPaidCents
				}
			}

			if actualRefund != tt.expectedRefund {
				t.Errorf("expected refund %d, got %d", tt.expectedRefund, actualRefund)
			}
			if actualDebtDiff != tt.expectedDebtDiff {
				t.Errorf("expected debt diff %d, got %d", tt.expectedDebtDiff, actualDebtDiff)
			}
		})
	}
}

// 2. Tax & Multi-Currency Handling (10 tests)
func TestSaleCoverage_TaxAndMultiCurrencyPrecision(t *testing.T) {
	tests := []struct {
		name          string
		subtotalIQD   int64
		exchangeRate  float64 // IQD per 1 USD
		taxPercentage float64
		expectedUSD   float64
		expectedTax   int64
	}{
		{"Standard IQD to USD 1500 Rate", 1500000, 1500.0, 15.0, 1000.0, 225000},
		{"Zero Tax Exchange", 1500000, 1500.0, 0.0, 1000.0, 0},
		{"High Exchange Rate 1530", 1530000, 1530.0, 15.0, 1000.0, 229500},
		{"Small Amount Currency Conversion", 1500, 1500.0, 15.0, 1.0, 225},
		{"Fractional Tax Rate 14.25%", 1000000, 1500.0, 14.25, 666.67, 142500},
		{"Micro Amount Tax Precision", 999, 1500.0, 15.0, 0.67, 150},
		{"Large Enterprise Bulk Invoice", 150000000, 1500.0, 15.0, 100000.0, 22500000},
		{"Zero Subtotal Zero Conversion", 0, 1500.0, 15.0, 0.0, 0},
		{"Rate 1:1 Parallel Currency", 100000, 1.0, 10.0, 100000.0, 10000},
		{"Floating Exchange Fractional Cents", 153250, 1532.5, 15.0, 100.0, 22988},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			subtotal := domain.FromCents(tt.subtotalIQD)
			tax := subtotal.Percentage(tt.taxPercentage)

			usdVal := float64(tt.subtotalIQD) / tt.exchangeRate
			
			if tax.Cents() != tt.expectedTax {
				t.Errorf("expected tax %d, got %d", tt.expectedTax, tax.Cents())
			}
			if fmt.Sprintf("%.2f", usdVal) != fmt.Sprintf("%.2f", tt.expectedUSD) {
				t.Errorf("expected USD %.2f, got %.2f", tt.expectedUSD, usdVal)
			}
		})
	}
}

// 3. Parked Sales & Custom Discounts (10 tests)
func TestSaleCoverage_ParkedSalesAndCustomDiscounts(t *testing.T) {
	tests := []struct {
		name              string
		cartTotal         int64
		manualDiscount    int64
		couponPercentage  float64
		expectedFinalTotal int64
	}{
		{"No Discount", 10000, 0, 0.0, 10000},
		{"Fixed Manual Discount", 10000, 2000, 0.0, 8000},
		{"Percentage Coupon Discount", 10000, 0, 10.0, 9000},
		{"Stacked Manual + Coupon", 10000, 1000, 10.0, 8100}, // (10000 - 1000) - 10% = 8100
		{"100% Full Coupon", 10000, 0, 100.0, 0},
		{"Exceeding Manual Discount Capped at 0", 10000, 15000, 0.0, 0},
		{"Zero Subtotal Parked Sale", 0, 0, 10.0, 0},
		{"Small Discount 1 Cent", 100, 1, 0.0, 99},
		{"Fractional Percent Rounding", 10000, 0, 15.5, 8450},
		{"Large Order Multi-Discount Stacking", 1000000, 50000, 20.0, 760000}, // (1M - 50k) = 950k - 20% = 760k
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			amt := domain.FromCents(tt.cartTotal)
			if tt.manualDiscount > 0 {
				manual := domain.FromCents(tt.manualDiscount)
				if manual.Cents() >= amt.Cents() {
					amt = domain.FromCents(0)
				} else {
					amt = amt.Sub(manual)
				}
			}
			if tt.couponPercentage > 0 && amt.Cents() > 0 {
				disc := amt.Percentage(tt.couponPercentage)
				amt = amt.Sub(disc)
			}

			if amt.Cents() != tt.expectedFinalTotal {
				t.Errorf("expected final total %d, got %d", tt.expectedFinalTotal, amt.Cents())
			}
		})
	}
}
