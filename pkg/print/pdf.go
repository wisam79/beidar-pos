package print

import (
	"beidar-desktop/internal/core/domain"
	"embed"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
	"github.com/jung-kurt/gofpdf"
	"github.com/skip2/go-qrcode"
)

//go:embed fonts/*
var embeddedFonts embed.FS

// PrintSettings holds configuration for printing
type PrintSettings struct {
	Format      string // "thermal" or "a4"
	PaperWidth  float64
	PaperHeight float64
	Copies      int
}

// GenerateInvoicePDFToPath creates a PDF at the specified path
func GenerateInvoicePDFToPath(sale domain.Sale, prefs domain.AppPreferences, format string, savePath string) (string, error) {
	return generatePDF(sale, prefs, format, savePath)
}

// Internal helper to generate PDF and save to path
func generatePDF(sale domain.Sale, prefs domain.AppPreferences, format string, savePath string) (string, error) {
	if format == "thermal" {
		return generateThermalPDF(sale, prefs, savePath)
	}
	return generateA4PDF(sale, prefs, savePath)
}

// prepareTajawalFontBytes loads the embedded Tajawal fonts directly from memory
// for gofpdf and Maroto without touching the filesystem.
func prepareTajawalFontBytes() (regularBytes, boldBytes []byte, err error) {
	regularBytes, err = embeddedFonts.ReadFile("fonts/Tajawal-Regular.ttf")
	if err != nil {
		return nil, nil, fmt.Errorf("embedded font Tajawal-Regular.ttf is missing: %w", err)
	}
	boldBytes, err = embeddedFonts.ReadFile("fonts/Tajawal-Bold.ttf")
	if err != nil {
		return nil, nil, fmt.Errorf("embedded font Tajawal-Bold.ttf is missing: %w", err)
	}
	return regularBytes, boldBytes, nil
}

func generateThermalPDF(sale domain.Sale, prefs domain.AppPreferences, savePath string) (string, error) {
	var pdf *gofpdf.Fpdf

	// Thermal: Dynamic width based on settings, auto height
	paperWidth := 80.0 // Default 80mm
	switch prefs.ThermalPaperSize {
	case "58mm":
		paperWidth = 58.0
	case "110mm":
		paperWidth = 110.0
	}
	pdf = gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr: "mm",
		Size:    gofpdf.SizeType{Wd: paperWidth, Ht: 200},
	})
	pdf.SetMargins(2, 2, 2)
	lineWidth := paperWidth - 4 // 2mm margins on each side

	// Arabic requires Tajawal; load directly from embedded bytes.
	regularFontBytes, boldFontBytes, err := prepareTajawalFontBytes()
	if err != nil {
		return "", err
	}
	pdf.AddUTF8FontFromBytes("arabic", "", regularFontBytes)
	pdf.AddUTF8FontFromBytes("arabic", "B", boldFontBytes)

	pdf.AddPage()
	pdf.SetFont("arabic", "B", 14)

	// Header
	pdf.CellFormat(0, 8, prefs.StoreName, "", 1, "C", false, 0, "")
	pdf.SetFont("arabic", "", 10)
	pdf.CellFormat(0, 5, prefs.StoreAddress, "", 1, "C", false, 0, "")

	// Invoice Info
	pdf.Ln(5)
	pdf.SetFont("arabic", "B", 10)
	pdf.CellFormat(0, 5, fmt.Sprintf("Invoice #%s", sale.ID), "", 1, "R", false, 0, "")
	pdf.SetFont("arabic", "", 9)
	pdf.CellFormat(0, 5, sale.Date, "", 1, "R", false, 0, "")

	// Customer
	if sale.CustomerName != "" {
		pdf.Ln(3)
		pdf.CellFormat(0, 5, fmt.Sprintf("Customer: %s", sale.CustomerName), "", 1, "R", false, 0, "")
	}

	// Line separator
	pdf.Ln(3)
	pdf.Line(pdf.GetX(), pdf.GetY(), pdf.GetX()+lineWidth, pdf.GetY())
	pdf.Ln(3)

	// Items Header
	pdf.SetFont("arabic", "B", 9)
	pdf.CellFormat(40, 5, "Product", "B", 0, "R", false, 0, "")
	pdf.CellFormat(18, 5, "Qty", "B", 0, "C", false, 0, "")
	pdf.CellFormat(18, 5, "Total", "B", 1, "L", false, 0, "")

	// Items
	pdf.SetFont("arabic", "", 9)
	for _, item := range sale.Items {
		pdf.CellFormat(40, 5, item.Name, "", 0, "R", false, 0, "")
		pdf.CellFormat(18, 5, fmt.Sprintf("%.0f", item.Quantity), "", 0, "C", false, 0, "")
		pdf.CellFormat(18, 5, fmt.Sprintf("%.2f", item.Total.Float()), "", 1, "L", false, 0, "")
	}

	// Totals
	pdf.Ln(3)
	pdf.Line(pdf.GetX(), pdf.GetY(), pdf.GetX()+lineWidth, pdf.GetY())
	pdf.Ln(3)

	pdf.SetFont("arabic", "B", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("Subtotal: %.2f %s", sale.Subtotal.Float(), prefs.Currency), "", 1, "R", false, 0, "")

	if sale.Discount > 0 {
		pdf.CellFormat(0, 6, fmt.Sprintf("Discount: -%.2f %s", sale.Discount.Float(), prefs.Currency), "", 1, "R", false, 0, "")
	}

	pdf.SetFont("arabic", "B", 12)
	pdf.CellFormat(0, 8, fmt.Sprintf("Total: %.2f %s", sale.Total.Float(), prefs.Currency), "", 1, "R", false, 0, "")

	// Installment Schedule
	if sale.InstallmentPlan != nil && len(sale.InstallmentPlan.Schedule) > 0 {
		pdf.Ln(5)
		pdf.SetFont("arabic", "B", 10)
		pdf.CellFormat(0, 6, "Installment Schedule / جدول الأقساط", "B", 1, "C", false, 0, "")

		pdf.Ln(2)
		pdf.SetFont("arabic", "B", 8)

		// Header
		pdf.CellFormat(10, 5, "#", "B", 0, "C", false, 0, "")
		pdf.CellFormat(25, 5, "Date", "B", 0, "C", false, 0, "")
		pdf.CellFormat(20, 5, "Amount", "B", 0, "C", false, 0, "")
		pdf.CellFormat(20, 5, "Status", "B", 1, "C", false, 0, "")

		// Body
		pdf.SetFont("arabic", "", 8)
		for _, inst := range sale.InstallmentPlan.Schedule {
			statusMark := "Pending"
			if inst.Status == "paid" {
				statusMark = "(PAID) OK"
			}
			pdf.CellFormat(10, 5, fmt.Sprintf("%d", inst.Number), "", 0, "C", false, 0, "")
			pdf.CellFormat(25, 5, inst.DueDate, "", 0, "C", false, 0, "")
			pdf.CellFormat(20, 5, fmt.Sprintf("%.2f", inst.Amount.Float()), "", 0, "C", false, 0, "")
			pdf.CellFormat(20, 5, statusMark, "", 1, "C", false, 0, "")
		}
		pdf.Ln(5)
	}

	// QR Code
	qrData := fmt.Sprintf("INV:%s|T:%.2f|D:%s", sale.ID, sale.Total.Float(), sale.Date)
	qrBytes, err := qrcode.Encode(qrData, qrcode.Medium, 80)
	if err == nil {
		qrTempFile := filepath.Join(filepath.Dir(savePath), fmt.Sprintf("qr_%s.png", sale.ID))
		if err := os.WriteFile(qrTempFile, qrBytes, 0644); err == nil {
			pdf.Ln(5)
			pdf.ImageOptions(qrTempFile, 30, pdf.GetY(), 20, 20, false, gofpdf.ImageOptions{}, 0, "")
			pdf.Ln(22)
			defer os.Remove(qrTempFile)
		}
	}

	// Footer
	pdf.SetFont("arabic", "", 8)
	pdf.CellFormat(0, 5, "Thank you for your purchase!", "", 1, "C", false, 0, "")

	// Save PDF
	if err := pdf.OutputFileAndClose(savePath); err != nil {
		return "", fmt.Errorf("failed to save thermal PDF: %w", err)
	}

	return savePath, nil
}

func generateA4PDF(sale domain.Sale, prefs domain.AppPreferences, savePath string) (string, error) {
	// Arabic requires Tajawal; load directly from embedded bytes.
	regularFontBytes, boldFontBytes, err := prepareTajawalFontBytes()
	if err != nil {
		return "", err
	}

	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetBorder(false)

	m.AddUTF8FontFromBytes("arabic", consts.Normal, regularFontBytes)
	m.AddUTF8FontFromBytes("arabic", consts.Bold, boldFontBytes)

	fontFamily := "arabic"

	// 1. Header (Store name & details)
	m.Row(10, func() {
		m.Col(12, func() {
			m.Text(prefs.StoreName, props.Text{
				Align:  consts.Center,
				Family: fontFamily,
				Style:  consts.Bold,
				Size:   16,
			})
		})
	})
	m.Row(6, func() {
		m.Col(12, func() {
			details := prefs.StoreAddress
			if prefs.StorePhone != "" {
				details += " | " + prefs.StorePhone
			}
			m.Text(details, props.Text{
				Align:  consts.Center,
				Family: fontFamily,
				Size:   10,
			})
		})
	})

	m.Line(2)

	// 2. Invoice Metadata (ID, Date, Customer)
	m.Row(15, func() {
		m.Col(6, func() {
			m.Text(fmt.Sprintf("Invoice #%s", sale.ID), props.Text{
				Align:  consts.Left,
				Family: fontFamily,
				Style:  consts.Bold,
				Size:   11,
			})
			m.Text(sale.Date, props.Text{
				Align:  consts.Left,
				Family: fontFamily,
				Size:   9,
				Top:    5,
			})
		})
		m.Col(6, func() {
			if sale.CustomerName != "" {
				m.Text("Customer / العميل:", props.Text{
					Align:  consts.Right,
					Family: fontFamily,
					Style:  consts.Bold,
					Size:   10,
				})
				m.Text(sale.CustomerName, props.Text{
					Align:  consts.Right,
					Family: fontFamily,
					Size:   10,
					Top:    5,
				})
			}
		})
	})

	m.Line(4)

	// 3. Table Header
	m.Row(8, func() {
		m.Col(5, func() {
			m.Text("Product / المنتج", props.Text{Style: consts.Bold, Family: fontFamily, Size: 9, Align: consts.Right})
		})
		m.Col(2, func() {
			m.Text("Price / السعر", props.Text{Style: consts.Bold, Family: fontFamily, Size: 9, Align: consts.Center})
		})
		m.Col(2, func() {
			m.Text("Qty / الكمية", props.Text{Style: consts.Bold, Family: fontFamily, Size: 9, Align: consts.Center})
		})
		m.Col(3, func() {
			m.Text("Total / الإجمالي", props.Text{Style: consts.Bold, Family: fontFamily, Size: 9, Align: consts.Left})
		})
	})
	m.Line(2)

	// 4. Table Items
	for _, item := range sale.Items {
		m.Row(8, func() {
			m.Col(5, func() {
				m.Text(item.Name, props.Text{Family: fontFamily, Size: 9, Align: consts.Right})
			})
			m.Col(2, func() {
				m.Text(fmt.Sprintf("%.2f", item.Price.Float()), props.Text{Family: fontFamily, Size: 9, Align: consts.Center})
			})
			m.Col(2, func() {
				m.Text(fmt.Sprintf("%.0f", item.Quantity), props.Text{Family: fontFamily, Size: 9, Align: consts.Center})
			})
			m.Col(3, func() {
				m.Text(fmt.Sprintf("%.2f %s", item.Total.Float(), prefs.Currency), props.Text{Family: fontFamily, Size: 9, Align: consts.Left})
			})
		})
	}
	m.Line(2)

	// 5. Totals
	m.Row(6, func() {
		m.Col(12, func() {
			m.Text(fmt.Sprintf("Subtotal / المجموع الفرعي: %.2f %s", sale.Subtotal.Float(), prefs.Currency), props.Text{
				Align:  consts.Right,
				Family: fontFamily,
				Size:   10,
				Style:  consts.Bold,
			})
		})
	})
	if sale.Discount > 0 {
		m.Row(6, func() {
			m.Col(12, func() {
				m.Text(fmt.Sprintf("Discount / الخصم: -%.2f %s", sale.Discount.Float(), prefs.Currency), props.Text{
					Align:  consts.Right,
					Family: fontFamily,
					Size:   10,
					Style:  consts.Bold,
				})
			})
		})
	}
	m.Row(8, func() {
		m.Col(12, func() {
			m.Text(fmt.Sprintf("Total / المجموع الكلي: %.2f %s", sale.Total.Float(), prefs.Currency), props.Text{
				Align:  consts.Right,
				Family: fontFamily,
				Size:   12,
				Style:  consts.Bold,
			})
		})
	})

	// 6. Installment Schedule
	if sale.InstallmentPlan != nil && len(sale.InstallmentPlan.Schedule) > 0 {
		m.Line(2)
		m.Row(10, func() {
			m.Col(12, func() {
				m.Text("Installment Schedule / جدول الأقساط", props.Text{
					Align:  consts.Center,
					Family: fontFamily,
					Style:  consts.Bold,
					Size:   10,
				})
			})
		})
		m.Row(8, func() {
			m.Col(2, func() { m.Text("#", props.Text{Align: consts.Center, Style: consts.Bold, Family: fontFamily, Size: 8}) })
			m.Col(4, func() {
				m.Text("Due Date / تاريخ الاستحقاق", props.Text{Align: consts.Center, Style: consts.Bold, Family: fontFamily, Size: 8})
			})
			m.Col(3, func() {
				m.Text("Amount / المبلغ", props.Text{Align: consts.Center, Style: consts.Bold, Family: fontFamily, Size: 8})
			})
			m.Col(3, func() {
				m.Text("Status / الحالة", props.Text{Align: consts.Center, Style: consts.Bold, Family: fontFamily, Size: 8})
			})
		})
		m.Line(1)
		for _, inst := range sale.InstallmentPlan.Schedule {
			statusMark := "Pending / معلق"
			if inst.Status == "paid" {
				statusMark = "Paid / تم الدفع"
			}
			m.Row(6, func() {
				m.Col(2, func() {
					m.Text(fmt.Sprintf("%d", inst.Number), props.Text{Align: consts.Center, Family: fontFamily, Size: 8})
				})
				m.Col(4, func() { m.Text(inst.DueDate, props.Text{Align: consts.Center, Family: fontFamily, Size: 8}) })
				m.Col(3, func() {
					m.Text(fmt.Sprintf("%.2f %s", inst.Amount.Float(), prefs.Currency), props.Text{Align: consts.Center, Family: fontFamily, Size: 8})
				})
				m.Col(3, func() { m.Text(statusMark, props.Text{Align: consts.Center, Family: fontFamily, Size: 8}) })
			})
		}
	}

	// 7. QR Code & Footer
	qrData := fmt.Sprintf("INV:%s|T:%.2f|D:%s", sale.ID, sale.Total.Float(), sale.Date)
	m.Row(30, func() {
		m.Col(12, func() {
			m.QrCode(qrData, props.Rect{
				Percent: 40,
				Center:  true,
			})
		})
	})

	m.Row(10, func() {
		m.Col(12, func() {
			m.Text("Thank you for your purchase!", props.Text{
				Align:  consts.Center,
				Family: fontFamily,
				Size:   8,
			})
		})
	})

	if err := m.OutputFileAndClose(savePath); err != nil {
		return "", fmt.Errorf("failed to save A4 PDF via Maroto: %w", err)
	}

	return savePath, nil
}

// GenerateQRCodeBase64 creates a QR code and returns it as base64
func GenerateQRCodeBase64(data string, size int) (string, error) {
	png, err := qrcode.Encode(data, qrcode.Medium, size)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(png), nil
}
