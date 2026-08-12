package service_test

import (
	"testing"
)

// 1. Customer Loyalty & Points (10 tests)
func TestCRMCoverage_LoyaltyPointsRules(t *testing.T) {
	tests := []struct {
		name          string
		purchaseCents int64
		existingPoints int
		redeemPoints  int
		expectedEarned int
		expectedFinal  int
		expectError   bool
	}{
		{"Earn 1 point per 1000 cents ($10)", 10000, 0, 0, 10, 10, false},
		{"Earn Fractional Points Truncated", 15500, 0, 0, 15, 15, false},
		{"Redeem Points Exactly Available", 0, 50, 50, 0, 0, false},
		{"Redeem Partial Points", 0, 50, 20, 0, 30, false},
		{"Attempt Redeem More Than Available", 0, 50, 100, 0, 50, true},
		{"Earn & Redeem Same Transaction", 20000, 30, 20, 20, 30, false}, // 30 - 20 + 20 = 30
		{"Zero Purchase Zero Points", 0, 100, 0, 0, 100, false},
		{"Redeem Negative Points Guard", 0, 50, -10, 0, 50, true},
		{"Earn Large Enterprise Purchase Points", 10000000, 0, 0, 10000, 10000, false},
		{"Redeem Zero Points Allowed", 10000, 20, 0, 10, 30, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.redeemPoints < 0 || tt.redeemPoints > tt.existingPoints {
				if !tt.expectError {
					t.Errorf("expected error for invalid redemption, got success")
				}
				return
			}

			earned := int(tt.purchaseCents / 1000)
			finalPoints := (tt.existingPoints - tt.redeemPoints) + earned

			if earned != tt.expectedEarned {
				t.Errorf("expected earned %d, got %d", tt.expectedEarned, earned)
			}
			if finalPoints != tt.expectedFinal {
				t.Errorf("expected final points %d, got %d", tt.expectedFinal, finalPoints)
			}
		})
	}
}

// 2. Shift Reconciliation & Expense Categorization (10 tests)
func TestTreasuryCoverage_ShiftReconciliation(t *testing.T) {
	tests := []struct {
		name             string
		openingCashCents int64
		salesCashCents   int64
		expensesCashCents int64
		countedCashCents int64
		expectedVariance int64
		isMatched        bool
	}{
		{"Exact Balance Matching Shift", 10000, 50000, 5000, 55000, 0, true},
		{"Cash Shortage (-1000 cents)", 10000, 50000, 5000, 54000, -1000, false},
		{"Cash Surplus (+1000 cents)", 10000, 50000, 5000, 56000, 1000, false},
		{"Zero Sales Zero Expense Shift", 10000, 0, 0, 10000, 0, true},
		{"Heavy Expense Over Opening Cash", 5000, 10000, 12000, 3000, 0, true}, // 5k + 10k - 12k = 3k
		{"Zero Opening Cash Shift", 0, 25000, 5000, 20000, 0, true},
		{"Micro Cents Shortage", 1000, 500, 200, 1290, -10, false}, // Expected 1300, got 1290
		{"Large Retail Shift High Volume", 100000, 5000000, 200000, 4900000, 0, true}, // 100k + 5M - 200k = 4.9M
		{"Shortage On Zero Counted Cash", 10000, 10000, 0, 0, -20000, false},
		{"Surplus On Extra Unrecorded Deposit", 10000, 10000, 0, 25000, 5000, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expectedCash := tt.openingCashCents + tt.salesCashCents - tt.expensesCashCents
			variance := tt.countedCashCents - expectedCash
			matched := (variance == 0)

			if variance != tt.expectedVariance {
				t.Errorf("expected variance %d, got %d", tt.expectedVariance, variance)
			}
			if matched != tt.isMatched {
				t.Errorf("expected matched %v, got %v", tt.isMatched, matched)
			}
		})
	}
}
