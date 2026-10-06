package print

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
)

// pdfSaleFixture returns a fully-populated sale so every conditional branch in
// the invoice renderers (customer block, discount, installment schedule) is
// exercised at least once.
func pdfSaleFixture() domain.Sale {
	return domain.Sale{
		ID:            "sale-pdf-1",
		Date:          time.Now().Format("2006-01-02"),
		CustomerName:  "عميل تجربة",
		Subtotal:      domain.NewAmount(15000),
		Discount:      domain.NewAmount(500),
		Total:         domain.NewAmount(14500),
		PaymentMethod: "installment",
		Status:        "completed",
		Items: []domain.SaleItem{
			{
				ProductID: "p-1",
				Name:      "منتج عربي",
				Quantity:  2,
				Price:     domain.NewAmount(7500),
				Total:     domain.NewAmount(15000),
			},
		},
		InstallmentPlan: &domain.InstallmentPlan{
			TotalAmount: domain.NewAmount(14500),
			DownPayment: domain.NewAmount(5500),
			Months:      2,
			StartDate:   "2026-11-01",
			Schedule: []domain.Installment{
				{Number: 1, DueDate: "2026-11-01", Amount: domain.NewAmount(5000), Status: "paid"},
				{Number: 2, DueDate: "2026-12-01", Amount: domain.NewAmount(4500), Status: "pending"},
			},
		},
	}
}

func pdfPreferencesFixture() domain.AppPreferences {
	return domain.AppPreferences{
		StoreName:        "متجر بيدر",
		StoreAddress:     "بغداد - شارع التجارة",
		StorePhone:       "07700000000",
		Currency:         "IQD",
		ThermalPaperSize: "80mm",
	}
}

func assertPDFFile(t *testing.T, path string) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("expected PDF at %s: %v", path, err)
	}
	if info.Size() == 0 {
		t.Fatalf("PDF at %s is empty", path)
	}
	head, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read PDF: %v", err)
	}
	preview := head
	if len(preview) > 8 {
		preview = preview[:8]
	}
	if !strings.HasPrefix(string(head), "%PDF") {
		t.Errorf("file at %s is not a PDF (header = %q)", path, string(preview))
	}
}

// TestGenerateInvoicePDFToPath_Thermal covers the thermal renderer for every
// paper size plus the empty-customer variant, which skips the customer block.
func TestGenerateInvoicePDFToPath_Thermal(t *testing.T) {
	sizes := []string{"58mm", "110mm", "80mm"}

	for _, size := range sizes {
		t.Run("paper-"+size, func(t *testing.T) {
			prefs := pdfPreferencesFixture()
			prefs.ThermalPaperSize = size
			path := filepath.Join(t.TempDir(), "thermal-"+size+".pdf")

			got, err := GenerateInvoicePDFToPath(pdfSaleFixture(), prefs, "thermal", path)
			if err != nil {
				t.Fatalf("thermal PDF (%s): %v", size, err)
			}
			if got != path {
				t.Errorf("returned path = %q, want %q", got, path)
			}
			assertPDFFile(t, path)
		})
	}

	t.Run("without-customer", func(t *testing.T) {
		sale := pdfSaleFixture()
		sale.CustomerName = ""
		// A cash sale without discount exercises the skipped-discount branch too.
		sale.Discount = domain.Zero()
		sale.InstallmentPlan = nil
		path := filepath.Join(t.TempDir(), "thermal-cash.pdf")

		if _, err := GenerateInvoicePDFToPath(sale, pdfPreferencesFixture(), "thermal", path); err != nil {
			t.Fatalf("thermal cash PDF: %v", err)
		}
		assertPDFFile(t, path)
	})
}

// TestGenerateInvoicePDFToPath_A4 covers the A4 renderer, including the
// installment schedule block.
func TestGenerateInvoicePDFToPath_A4(t *testing.T) {
	path := filepath.Join(t.TempDir(), "invoice-a4.pdf")

	got, err := GenerateInvoicePDFToPath(pdfSaleFixture(), pdfPreferencesFixture(), "a4", path)
	if err != nil {
		t.Fatalf("a4 PDF: %v", err)
	}
	if got != path {
		t.Errorf("returned path = %q, want %q", got, path)
	}
	assertPDFFile(t, path)

	t.Run("unknown-format-falls-back-to-a4", func(t *testing.T) {
		fallbackPath := filepath.Join(t.TempDir(), "invoice-fallback.pdf")
		if _, err := GenerateInvoicePDFToPath(pdfSaleFixture(), pdfPreferencesFixture(), "whatever", fallbackPath); err != nil {
			t.Fatalf("fallback PDF: %v", err)
		}
		assertPDFFile(t, fallbackPath)
	})
}

// TestGenerateInvoicePDFToPath_UnwritablePath asserts a real write failure is
// surfaced instead of producing a silent success with no file on disk.
func TestGenerateInvoicePDFToPath_UnwritablePath(t *testing.T) {
	missingDir := filepath.Join(t.TempDir(), "no-such-dir", "invoice.pdf")

	if _, err := GenerateInvoicePDFToPath(pdfSaleFixture(), pdfPreferencesFixture(), "thermal", missingDir); err == nil {
		t.Fatal("expected an error when the target directory does not exist")
	}
}

// TestGenerateQRCodeBase64 asserts the QR helper returns a decodable PNG.
func TestGenerateQRCodeBase64(t *testing.T) {
	encoded, err := GenerateQRCodeBase64("INV:sale-pdf-1|T:14500.00", 256)
	if err != nil {
		t.Fatalf("GenerateQRCodeBase64: %v", err)
	}

	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("result is not valid base64: %v", err)
	}
	pngSignature := []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}
	if len(raw) < len(pngSignature) || string(raw[:len(pngSignature)]) != string(pngSignature) {
		t.Errorf("decoded payload is not a PNG (got %d bytes)", len(raw))
	}
}

// TestGenerateQRCodeBase64_TooSmallSize asserts an impossible QR size is
// reported as an error rather than an empty-but-successful code.
func TestGenerateQRCodeBase64_TooSmallSize(t *testing.T) {
	if _, err := GenerateQRCodeBase64("x", 1); err == nil {
		t.Fatal("expected an error for an invalid QR size")
	}
}
