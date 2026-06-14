package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/pkg/print"
	"net"
	"os"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupPrintTestDB(t *testing.T) (service.PrintService, *gorm.DB, func()) {
	dbFileName := "test_print_" + uuid.New().String()[:8] + ".db"
	os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	if err := db.AutoMigrate(
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Payment{},
		&domain.AppPreferences{},
	); err != nil {
		t.Fatalf("Failed to migrate test DB: %v", err)
	}

	// Create default preferences
	db.Create(&domain.AppPreferences{
		ID:               1,
		StoreName:        "بيدر اختبار",
		StoreAddress:     "عنوان الاختبار",
		Currency:         "IQD",
		ThermalPaperSize: "80mm",
	})

	saleRepo := repository.NewSaleRepository(db)
	preferencesRepo := repository.NewPreferencesRepository(db)
	printService := service.NewPrintService(saleRepo, preferencesRepo)

	return printService, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		os.Remove(dbFileName)
	}
}

func TestGenerateQRCode(t *testing.T) {
	printService, _, cleanup := setupPrintTestDB(t)
	defer cleanup()

	qrBase64, err := printService.GenerateQRCode("https://beidar.net", 100)
	if err != nil {
		t.Fatalf("Failed to generate QR code: %v", err)
	}

	if len(qrBase64) == 0 {
		t.Errorf("Expected non-empty base64 string for QR code")
	}
}

func TestBuildESCPOSReceipt(t *testing.T) {
	items := []domain.ReceiptItem{
		{Name: "تفاحة", Qty: 3, Price: 1500, Total: 4500},
		{Name: "موز", Qty: 2, Price: 2000, Total: 4000},
	}

	receiptBytes := print.BuildESCPOSReceipt("بيدر تيست", items, 8500, "IQD")
	if len(receiptBytes) == 0 {
		t.Errorf("Expected non-empty ESC/POS receipt byte array")
	}
}

func TestGenerateInvoicePDFToPath(t *testing.T) {
	printService, db, cleanup := setupPrintTestDB(t)
	defer cleanup()

	// Seed a sale
	sale := &domain.Sale{
		ID:           "sale_1",
		CustomerName: "مشتري تجريبي",
		Date:         "2026-06-11",
		Subtotal:     8500,
		Total:        8500,
		Items: []domain.SaleItem{
			{ProductID: "prod_1", Name: "تفاحة", Price: 1500, Quantity: 3, Total: 4500},
			{ProductID: "prod_2", Name: "موز", Price: 2000, Quantity: 2, Total: 4000},
		},
	}

	if err := db.Create(sale).Error; err != nil {
		t.Fatalf("Failed to seed sale: %v", err)
	}

	tempFile := filepath.Join(os.TempDir(), "test_invoice_out.pdf")
	defer os.Remove(tempFile)

	pdfPath, err := printService.GenerateInvoicePDFToPath("sale_1", "a4", tempFile)
	if err != nil {
		t.Fatalf("Failed to generate PDF: %v", err)
	}

	if pdfPath != tempFile {
		t.Errorf("Expected output path %s, got %s", tempFile, pdfPath)
	}

	info, err := os.Stat(tempFile)
	if err != nil {
		t.Fatalf("PDF file does not exist: %v", err)
	}

	if info.Size() == 0 {
		t.Errorf("Expected PDF file size to be greater than 0")
	}
}

func TestPrintService_DirectPrinting(t *testing.T) {
	printService, _, cleanup := setupPrintTestDB(t)
	defer cleanup()

	// Start local TCP server to mock a network printer
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Failed to start local TCP listener: %v", err)
	}
	defer ln.Close()

	addr := ln.Addr().String()

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			// Read all data and close
			buf := make([]byte, 1024)
			for {
				_, err := conn.Read(buf)
				if err != nil {
					break
				}
			}
			conn.Close()
		}
	}()

	// Cover GetAvailablePrinters and GetDefaultPrinter
	_, _ = printService.GetAvailablePrinters()
	_, _ = printService.GetDefaultPrinter()

	// Test PrintReceiptDirect
	receiptItems := []domain.ReceiptItem{
		{Name: "Item A", Qty: 1, Price: 100, Total: 100},
	}
	err = printService.PrintReceiptDirect(addr, "Test Store", receiptItems, 100, "IQD")
	if err != nil {
		t.Errorf("PrintReceiptDirect failed: %v", err)
	}

	// Test TestPrinter
	err = printService.TestPrinter(addr)
	if err != nil {
		t.Errorf("TestPrinter failed: %v", err)
	}

	// Test PrintBitmapReceipt
	tinyPng := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
	err = printService.PrintBitmapReceipt(addr, tinyPng)
	if err != nil {
		t.Errorf("PrintBitmapReceipt failed: %v", err)
	}

	// Test PrintBitmapReceipt with data URL prefix
	err = printService.PrintBitmapReceipt(addr, "data:image/png;base64,"+tinyPng)
	if err != nil {
		t.Errorf("PrintBitmapReceipt with prefix failed: %v", err)
	}
}

