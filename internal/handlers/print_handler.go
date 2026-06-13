package handlers

import (
	"beidar-desktop/internal/core/domain"
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// PrintHandler handles Wails printing and PDF requests
type PrintHandler struct {
	ctx          context.Context
	printService domain.PrintService
}

// NewPrintHandler creates a new instance of PrintHandler
func NewPrintHandler(printService domain.PrintService) *PrintHandler {
	return &PrintHandler{
		printService: printService,
	}
}

// Startup is called when the app starts
func (h *PrintHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

// GenerateInvoicePDF shows a save dialog and generates the PDF invoice at the chosen path
func (h *PrintHandler) GenerateInvoicePDF(saleID string, format string) (string, error) {
	defaultFilename := fmt.Sprintf("فاتورة_%s.pdf", saleID)
	savePath, err := runtime.SaveFileDialog(h.ctx, runtime.SaveDialogOptions{
		Title:           "حفظ الفاتورة PDF",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "PDF Files (*.pdf)", Pattern: "*.pdf"},
		},
	})

	if err != nil {
		return "", fmt.Errorf("dialog error: %v", err)
	}

	if savePath == "" {
		return "", fmt.Errorf("cancelled")
	}

	return h.printService.GenerateInvoicePDFToPath(saleID, format, savePath)
}

// GenerateQRCode creates a QR code and returns it as a base64 encoded string
func (h *PrintHandler) GenerateQRCode(data string, size int) (string, error) {
	return h.printService.GenerateQRCode(data, size)
}

// GetAvailablePrinters returns the list of system printers
func (h *PrintHandler) GetAvailablePrinters() ([]domain.PrinterInfo, error) {
	return h.printService.GetAvailablePrinters()
}

// GetDefaultPrinter returns the default system printer
func (h *PrintHandler) GetDefaultPrinter() (string, error) {
	return h.printService.GetDefaultPrinter()
}

// PrintReceiptDirect sends an ESC/POS receipt directly to a printer
func (h *PrintHandler) PrintReceiptDirect(printerName, storeName string, items []domain.ReceiptItem, total float64, currency string) error {
	return h.printService.PrintReceiptDirect(printerName, storeName, items, total, currency)
}

// TestPrinter prints a test page
func (h *PrintHandler) TestPrinter(printerName string) error {
	return h.printService.TestPrinter(printerName)
}

// PrintBitmapReceipt prints a base64 receipt image directly
func (h *PrintHandler) PrintBitmapReceipt(printerName, base64Image string) error {
	return h.printService.PrintBitmapReceipt(printerName, base64Image)
}
