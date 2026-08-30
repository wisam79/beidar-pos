package e2e

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
	"github.com/google/uuid"
)

// ═══════════════════════════════════════════════════════════════════════════
// 🎲 GO NATIVE FUZZ TESTING
// ═══════════════════════════════════════════════════════════════════════════

// FuzzFormulaSanitization fuzz-tests formula injection sanitization logic.
// Ensures that any string starting with [=, +, -, @] is always safely prefixed with '.
func FuzzFormulaSanitization(f *testing.F) {
	// Seed corpus with realistic and malicious inputs
	seeds := []string{
		"=cmd|' /C calc'!A0",
		"+123456",
		"-5000",
		"@SUM(A1:A10)",
		"منتج عادي",
		"",
		" ",
		"\t=1+1",
		"normal-text",
	}
	for _, seed := range seeds {
		f.Add(seed)
	}

	f.Fuzz(func(t *testing.T, input string) {
		sanitized := sanitizeForExport(input)

		trimmed := strings.TrimLeft(input, " \t\r\n")
		if len(trimmed) > 0 {
			firstChar := trimmed[0]
			if firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@' {
				if !strings.HasPrefix(sanitized, "'") {
					t.Errorf("expected sanitized string to be prefixed with single quote for input %q, got %q", input, sanitized)
				}
			}
		}
	})
}

// sanitizeForExport helper representing the CSV sanitization rule from AGENTS.md
func sanitizeForExport(s string) string {
	trimmed := strings.TrimLeft(s, " \t\r\n")
	if len(trimmed) > 0 {
		first := trimmed[0]
		if first == '=' || first == '+' || first == '-' || first == '@' {
			return "'" + s
		}
	}
	return s
}

// FuzzAmountParsing tests domain.Amount parsing against arbitrary string inputs.
// It must never panic on any malformed, astronomical, or corrupt string.
func FuzzAmountParsing(f *testing.F) {
	f.Add("1000")
	f.Add("0.50")
	f.Add("-25000")
	f.Add("abc")
	f.Add("9999999999999999999999999999999999999999999999999999999999999")
	f.Add("0")
	f.Add("12.345678")

	f.Fuzz(func(t *testing.T, input string) {
		// Calling ParseAmount should return either parsed amount or error, but NEVER panic.
		amt, err := domain.ParseAmount(input)
		if err == nil {
			_ = amt.String()
			_ = amt.Cents()
		}
	})
}

// ═══════════════════════════════════════════════════════════════════════════
// ⏱️ HIGH-THROUGHPUT PERFORMANCE BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════

// BenchmarkEndToEnd_SaleProcessing measures full transactional sales throughput.
func BenchmarkEndToEnd_SaleProcessing(b *testing.B) {
	h, cleanup := NewHarness(&testing.T{})
	defer cleanup()

	staff, _ := h.Repos.staff.GetByUsername(AdminUsername)
	auth.Set(staff, nil)
	defer auth.Clear()

	prod := h.NewProduct("منتج اختبار السرعة", 25000, float64(b.N+100))
	cust := h.NewCustomer("عميل اختبار الأداء", 0)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		sale := domain.Sale{
			ID:            fmt.Sprintf("BENCH-%d-%s", i, uuid.New().String()[:8]),
			CustomerID:    cust.ID,
			CustomerName:  cust.Name,
			StaffID:       staff.ID,
			Date:          time.Now().Format("2006-01-02"),
			Timestamp:     time.Now().UnixMilli(),
			Subtotal:      prod.Price,
			Total:         prod.Price,
			PaymentMethod: "cash",
			Status:        "completed",
			ItemsCount:    1,
			Items: []domain.SaleItem{
				{
					ProductID: prod.ID,
					Name:      prod.Name,
					Quantity:  1,
					Price:     prod.Price,
					Total:     prod.Price,
				},
			},
		}

		if err := h.SaleHandler.ProcessSale(sale); err != nil {
			b.Fatalf("ProcessSale benchmark iteration failed: %v", err)
		}
	}
}

// BenchmarkCustomerSearch measures CRM search query speed over large datasets.
func BenchmarkCustomerSearch(b *testing.B) {
	h, cleanup := NewHarness(&testing.T{})
	defer cleanup()

	staff, _ := h.Repos.staff.GetByUsername(AdminUsername)
	auth.Set(staff, nil)
	defer auth.Clear()

	// Seed 200 customers
	for i := 0; i < 200; i++ {
		_ = h.Repos.customer.Create(&domain.Customer{
			ID:    uuid.New().String(),
			Name:  fmt.Sprintf("العميل المشترك رقم %d", i),
			Phone: fmt.Sprintf("07700000%03d", i),
		})
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		results, err := h.CRMHandler.SearchCustomers("150")
		if err != nil {
			b.Fatalf("SearchCustomers failed: %v", err)
		}
		_ = results
	}
}
