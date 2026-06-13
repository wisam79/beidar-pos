package service

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/print"
	"fmt"
)

// PrintService defines business logic for printing operations
type PrintService interface {
	GenerateInvoicePDFToPath(saleID string, format string, savePath string) (string, error)
	GenerateQRCode(data string, size int) (string, error)
	GetAvailablePrinters() ([]domain.PrinterInfo, error)
	GetDefaultPrinter() (string, error)
	PrintReceiptDirect(printerName, storeName string, items []domain.ReceiptItem, total float64, currency string) error
	TestPrinter(printerName string) error
	PrintBitmapReceipt(printerName, base64Image string) error
}

type printService struct {
	saleRepo        domain.SaleRepository
	preferencesRepo domain.PreferencesRepository
}

// NewPrintService creates a new instance of PrintService
func NewPrintService(saleRepo domain.SaleRepository, preferencesRepo domain.PreferencesRepository) PrintService {
	return &printService{
		saleRepo:        saleRepo,
		preferencesRepo: preferencesRepo,
	}
}

func (s *printService) GenerateInvoicePDFToPath(saleID string, format string, savePath string) (string, error) {
	sale, err := s.saleRepo.GetByID(saleID)
	if err != nil {
		return "", fmt.Errorf("فشل العثور على الفاتورة: %w", err)
	}

	prefs, err := s.preferencesRepo.Get()
	if err != nil {
		return "", fmt.Errorf("فشل العثور على الإعدادات العامة: %w", err)
	}

	return print.GenerateInvoicePDFToPath(*sale, *prefs, format, savePath)
}

func (s *printService) GenerateQRCode(data string, size int) (string, error) {
	return print.GenerateQRCodeBase64(data, size)
}

func (s *printService) GetAvailablePrinters() ([]domain.PrinterInfo, error) {
	return print.GetAvailablePrinters()
}

func (s *printService) GetDefaultPrinter() (string, error) {
	return print.GetDefaultPrinter()
}

func (s *printService) PrintReceiptDirect(printerName, storeName string, items []domain.ReceiptItem, total float64, currency string) error {
	return print.PrintReceipt(printerName, storeName, items, total, currency)
}

func (s *printService) TestPrinter(printerName string) error {
	return print.TestPrinter(printerName)
}

func (s *printService) PrintBitmapReceipt(printerName, base64Image string) error {
	return print.PrintBitmapReceipt(printerName, base64Image)
}
