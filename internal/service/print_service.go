package service

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/print"
	"fmt"
)

type printService struct {
	saleRepo        domain.SaleRepository
	preferencesRepo domain.PreferencesRepository
}

// NewPrintService creates a new instance of domain.PrintService
func NewPrintService(saleRepo domain.SaleRepository, preferencesRepo domain.PreferencesRepository) domain.PrintService {
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

func (s *printService) PrintReceiptDirect(printerName, storeName string, items []domain.ReceiptItem, total domain.Amount, currency string) error {
	err := print.PrintReceipt(printerName, storeName, items, total, currency)
	if err != nil {
		// Hardware failure fallback: generate PDF silently to desktop
		// Since we don't have the full sale struct here, we can't easily use GenerateInvoicePDFToPath
		// But returning a wrapped error is enough for the handler to know it failed
		return fmt.Errorf("خطأ في الطابعة (%v). يرجى طباعة الفاتورة لاحقاً كملف PDF", err)
	}
	return nil
}

func (s *printService) TestPrinter(printerName string) error {
	return print.TestPrinter(printerName)
}

func (s *printService) PrintBitmapReceipt(printerName, base64Image string) error {
	return print.PrintBitmapReceipt(printerName, base64Image)
}
