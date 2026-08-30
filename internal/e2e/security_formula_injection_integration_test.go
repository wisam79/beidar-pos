package e2e

import (
	"strings"
	"testing"
)

// TestE2E_FormulaInjection_SanitizationOnExport tests CSV Formula Injection / DDE defenses (Rule 3.2):
// Fields starting with '=', '+', '-', '@' must be sanitized with a leading single quote '\''
// when exported to CSV to prevent Remote Code Execution (RCE) / arbitrary formula execution.
func TestE2E_FormulaInjection_SanitizationOnExport(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// 1. Create products with malicious CSV injection payloads in free text fields
	p1 := h.NewProduct("=cmd|'/C calc'!A0", 10000, 10)
	p1.Barcode = "+1234567890"
	p1.Description = "@hyperlink(\"http://malicious.site\",\"Click\")"
	p1.Category = "-CategoryExploit"
	p1.Supplier = "=SUM(1+1)*cmd"
	if err := h.Repos.product.Update(p1); err != nil {
		t.Fatalf("Update p1 failed: %v", err)
	}

	p2 := h.NewProduct("+NormalLookingProduct", 20000, 5)
	p2.Barcode = "-9876543210"
	if err := h.Repos.product.Update(p2); err != nil {
		t.Fatalf("Update p2 failed: %v", err)
	}

	// 2. Export products via BackupHandler
	csvResult, err := h.BackupHandler.ExportProductsCSV()
	if err != nil {
		t.Fatalf("ExportProductsCSV failed: %v", err)
	}

	if csvResult == nil || csvResult.Data == "" {
		t.Fatal("expected non-empty CSV export result")
	}

	lines := strings.Split(strings.TrimSpace(csvResult.Data), "\n")
	if len(lines) < 3 {
		t.Fatalf("expected header + at least 2 product rows, got %d lines", len(lines))
	}

	// 3. Verify that all dangerous starting characters are neutralized with '\''
	// Verify p1 fields
	csvContent := csvResult.Data

	// Name "=cmd..." should become "'=cmd..."
	if !strings.Contains(csvContent, "'=cmd|'/C calc'!A0") {
		t.Errorf("expected sanitized product name ''=cmd...', content:\n%s", csvContent)
	}

	// Barcode "+1234..." should become "'+1234..."
	if !strings.Contains(csvContent, "'+1234567890") {
		t.Errorf("expected sanitized barcode ''+1234...', content:\n%s", csvContent)
	}

	// Description "@hyperlink..." should become "'@hyperlink..."
	if !strings.Contains(csvContent, "'@hyperlink") {
		t.Errorf("expected sanitized description ''@hyperlink...', content:\n%s", csvContent)
	}

	// Category "-CategoryExploit" should become "'-CategoryExploit"
	if !strings.Contains(csvContent, "'-CategoryExploit") {
		t.Errorf("expected sanitized category ''-CategoryExploit', content:\n%s", csvContent)
	}

	// Supplier "=SUM..." should become "'=SUM..."
	if !strings.Contains(csvContent, "'=SUM(1+1)*cmd") {
		t.Errorf("expected sanitized supplier ''=SUM...', content:\n%s", csvContent)
	}

	// 4. Verify unauthenticated access to export is rejected
	h.StaffHandler.Logout()
	_, err = h.BackupHandler.ExportProductsCSV()
	if err == nil {
		t.Fatal("expected unauthenticated ExportProductsCSV to be rejected")
	}
}
