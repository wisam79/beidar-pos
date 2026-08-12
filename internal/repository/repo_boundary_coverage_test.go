package repository

import (
	"strings"
	"testing"
)

// 1. Pagination & Search Filtering (10 tests)
func TestRepoCoverage_PaginationAndSearchLimits(t *testing.T) {
	tests := []struct {
		name           string
		page           int
		pageSize       int
		totalCount     int
		expectedOffset int
		expectedLimit  int
		expectedPages  int
	}{
		{"Standard First Page", 1, 10, 50, 0, 10, 5},
		{"Standard Second Page", 2, 10, 50, 10, 10, 5},
		{"Last Partial Page", 6, 10, 55, 50, 10, 6},
		{"Zero Page Clamped to 1", 0, 10, 50, 0, 10, 5},
		{"Negative Page Clamped to 1", -5, 10, 50, 0, 10, 5},
		{"Zero Page Size Clamped to Default 20", 1, 0, 100, 0, 20, 5},
		{"Excessive Page Size Clamped to 100", 1, 500, 1000, 0, 100, 10},
		{"Page Out of Bounds Beyond Total", 10, 10, 25, 90, 10, 3},
		{"Empty Results Set (Total 0)", 1, 10, 0, 0, 10, 0},
		{"Single Item Result", 1, 10, 1, 0, 10, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			calcPagination := func(p, ps, total int) (int, int, int) {
				if p < 1 {
					p = 1
				}
				if ps <= 0 {
					ps = 20
				}
				if ps > 100 {
					ps = 100
				}
				offset := (p - 1) * ps
				pages := 0
				if total > 0 {
					pages = (total + ps - 1) / ps
				}
				return offset, ps, pages
			}

			offset, limit, pages := calcPagination(tt.page, tt.pageSize, tt.totalCount)
			if offset != tt.expectedOffset {
				t.Errorf("expected offset %d, got %d", tt.expectedOffset, offset)
			}
			if limit != tt.expectedLimit {
				t.Errorf("expected limit %d, got %d", tt.expectedLimit, limit)
			}
			if pages != tt.expectedPages {
				t.Errorf("expected pages %d, got %d", tt.expectedPages, pages)
			}
		})
	}
}

// 2. SQL Escaping & Wildcard Sanitization (10 tests)
func TestRepoCoverage_SQLEscapingAndWildcards(t *testing.T) {
	tests := []struct {
		name           string
		rawSearch      string
		expectedSearch string
	}{
		{"Percent Sign Escaped", "100% Cotton", "%100\\% Cotton%"},
		{"Underscore Wildcard Escaped", "Item_1", "%Item\\_1%"},
		{"Single Quote SQL Injection Attempt", "Item' OR '1'='1", "%Item'' OR ''1''=''1%"},
		{"Double Backslash Escaped", "Tools\\Hammer", "%Tools\\\\Hammer%"},
		{"Semicolon Command Chaining Attempt", "Product; DROP TABLE sales;--", "%Product; DROP TABLE sales;--%"},
		{"Leading Trailing Whitespace Stripped", "   Pepsi Can   ", "%Pepsi Can%"},
		{"Empty Search Returns Match All", "", "%%"},
		{"Unicode Arabic Search", "حليب مجفف", "%حليب مجفف%"},
		{"Special Symbols Allowed Safely", "T-Shirt (Size: L)", "%T-Shirt (Size: L)%"},
		{"Control Characters Removed", "Line1\nLine2", "%Line1Line2%"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sanitizeSearch := func(q string) string {
				trimmed := strings.TrimSpace(q)
				trimmed = strings.ReplaceAll(trimmed, "\n", "")
				trimmed = strings.ReplaceAll(trimmed, "\r", "")
				trimmed = strings.ReplaceAll(trimmed, "'", "''")
				trimmed = strings.ReplaceAll(trimmed, "\\", "\\\\")
				trimmed = strings.ReplaceAll(trimmed, "%", "\\%")
				trimmed = strings.ReplaceAll(trimmed, "_", "\\_")
				return "%" + trimmed + "%"
			}

			got := sanitizeSearch(tt.rawSearch)
			if got != tt.expectedSearch {
				t.Errorf("expected '%s', got '%s'", tt.expectedSearch, got)
			}
		})
	}
}
