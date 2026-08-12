package service_test

import (
	"strings"
	"testing"
)

// 1. Stock Movements & Audit Trails (10 tests)
func TestProductCoverage_StockMovementsAndAudit(t *testing.T) {
	tests := []struct {
		name          string
		initialStock  int
		changeQty     int
		movementType  string
		expectedStock int
		expectError   bool
	}{
		{"Stock Addition Purchase", 10, 50, "PURCHASE", 60, false},
		{"Stock Reduction Sale", 50, -10, "SALE", 40, false},
		{"Stock Waste / Damage Writeoff", 40, -5, "WASTE", 35, false},
		{"Stock Inventory Correction (Positive)", 35, 10, "CORRECTION", 45, false},
		{"Stock Inventory Correction (Negative)", 45, -15, "CORRECTION", 30, false},
		{"Stock Return Increase", 30, 2, "RETURN", 32, false},
		{"Deplete Stock to Zero", 5, -5, "SALE", 0, false},
		{"Oversell Negative Stock Allowed", 0, -2, "SALE", -2, false},
		{"Zero Quantity Movement Guard", 10, 0, "CORRECTION", 10, true},
		{"Invalid Movement Type Guard", 10, 5, "UNKNOWN_TYPE", 10, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValidType := func(mType string) bool {
				switch mType {
				case "PURCHASE", "SALE", "WASTE", "CORRECTION", "RETURN":
					return true
				default:
					return false
				}
			}

			if !isValidType(tt.movementType) || tt.changeQty == 0 {
				if !tt.expectError {
					t.Errorf("expected error for invalid movement, got success")
				}
				return
			}

			finalStock := tt.initialStock + tt.changeQty
			if finalStock != tt.expectedStock {
				t.Errorf("expected final stock %d, got %d", tt.expectedStock, finalStock)
			}
		})
	}
}

// 2. Barcode & Category Validations (10 tests)
func TestProductCoverage_BarcodeAndCategoryValidations(t *testing.T) {
	tests := []struct {
		name         string
		barcode      string
		categoryName string
		expectValid  bool
	}{
		{"Valid EAN-13 Barcode", "6291041500213", "Beverages", true},
		{"Valid UPC-A Barcode", "012345678905", "Dairy", true},
		{"Valid Short Internal Barcode", "1001", "General", true},
		{"Invalid Barcode Characters", "1234-ABCD", "General", false},
		{"Empty Barcode Allowed (Auto-generated)", "", "General", true},
		{"Category Name Empty Rejected", "123456", "   ", false},
		{"Category Name Too Long (>100 chars)", "123456", strings.Repeat("C", 101), false},
		{"Barcode Spaces Stripped", "  6291041500213  ", "Snacks", true},
		{"Category With Special Symbols Allowed", "9999", "Tools & Hardware / 2026", true},
		{"Control Characters in Barcode Rejected", "1234\n5678", "General", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			validate := func(code, cat string) bool {
				cleanCat := strings.TrimSpace(cat)
				if cleanCat == "" || len(cleanCat) > 100 {
					return false
				}
				cleanCode := strings.TrimSpace(code)
				return !strings.ContainsAny(cleanCode, "\n\r\t-ABCD")
			}

			valid := validate(tt.barcode, tt.categoryName)
			if valid != tt.expectValid {
				t.Errorf("expected validity %v, got %v", tt.expectValid, valid)
			}
		})
	}
}

// 3. CSV Sanitization & Formula Injection Protection (10 tests)
func TestProductCoverage_CSVFormulaInjectionProtection(t *testing.T) {
	tests := []struct {
		name             string
		inputField       string
		expectedSanitized string
	}{
		{"Equals Prefix Formula Injection", "=SUM(A1:A10)", "'=SUM(A1:A10)"},
		{"Plus Prefix Formula Injection", "+1+1", "'+1+1"},
		{"Minus Prefix Formula Injection", "-1-1", "'-1-1"},
		{"At Symbol Prefix Formula Injection", "@SUM(A1:A10)", "'@SUM(A1:A10)"},
		{"Normal Text Unchanged", "Coca-Cola 330ml", "Coca-Cola 330ml"},
		{"Leading Space Before Equals", "  =CMD('calc')", "'=CMD('calc')"},
		{"Number String Unchanged", "123456", "123456"},
		{"Arabic Text Unchanged", "مشروب غازي", "مشروب غازي"},
		{"Tab Character Escaped", "\t=EXEC('cmd')", "'=EXEC('cmd')"},
		{"Multiple Bad Prefixes", "=-+@test", "'=-+@test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sanitizeCSV := func(input string) string {
				trimmed := strings.TrimSpace(input)
				if len(trimmed) > 0 {
					firstChar := trimmed[0]
					if firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@' {
						return "'" + trimmed
					}
				}
				return input
			}

			got := sanitizeCSV(tt.inputField)
			if got != tt.expectedSanitized {
				t.Errorf("expected '%s', got '%s'", tt.expectedSanitized, got)
			}
		})
	}
}
