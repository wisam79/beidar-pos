//go:build !windows

package print

import (
	"beidar-desktop/internal/core/domain"
	"errors"
)

func GetAvailablePrinters() ([]domain.PrinterInfo, error) {
	return nil, errors.New("direct printing is not supported on this platform")
}

func GetDefaultPrinter() (string, error) {
	return "", errors.New("direct printing is not supported on this platform")
}

func PrintRaw(printerName string, data []byte) error {
	return errors.New("direct printing is not supported on this platform")
}

func BuildESCPOSReceipt(storeName string, items []domain.ReceiptItem, total float64, currency string) []byte {
	return nil
}

func PrintReceipt(printerName, storeName string, items []domain.ReceiptItem, total float64, currency string) error {
	return errors.New("direct printing is not supported on this platform")
}

func TestPrinter(printerName string) error {
	return errors.New("direct printing is not supported on this platform")
}

func PrintBitmapReceipt(printerName, base64Image string) error {
	return errors.New("direct printing is not supported on this platform")
}

func PrintBitmapReceiptWithPng(printerName string, pngData []byte) error {
	return errors.New("direct printing is not supported on this platform")
}

func PrintRawNetwork(ipAddress string, data []byte) error {
	return errors.New("direct printing is not supported on this platform")
}
