//go:build windows

package print

import (
	"beidar-desktop/internal/core/domain"
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"net"
	"os/exec"
	"strings"
	"syscall"
	"time"
	"unsafe"

	_ "image/gif"
	_ "image/jpeg"
)

var (
	winspool             = syscall.NewLazyDLL("winspool.drv")
	procOpenPrinterW     = winspool.NewProc("OpenPrinterW")
	procClosePrinter     = winspool.NewProc("ClosePrinter")
	procStartDocPrinterW = winspool.NewProc("StartDocPrinterW")
	procEndDocPrinter    = winspool.NewProc("EndDocPrinter")
	procStartPagePrinter = winspool.NewProc("StartPagePrinter")
	procEndPagePrinter   = winspool.NewProc("EndPagePrinter")
	procWritePrinter     = winspool.NewProc("WritePrinter")
)

const (
	PRINTER_ENUM_LOCAL       = 0x00000002
	PRINTER_ENUM_CONNECTIONS = 0x00000004
)

// GetAvailablePrinters returns list of installed printers
func GetAvailablePrinters() ([]domain.PrinterInfo, error) {
	printers, err := getPrintersFromRegistry()
	if err == nil && len(printers) > 0 {
		return printers, nil
	}
	return getPrintersFromWMI()
}

func getPrintersFromRegistry() ([]domain.PrinterInfo, error) {
	cmd := exec.Command("reg", "query", `HKCU\Software\Microsoft\Windows NT\CurrentVersion\Devices`)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(output), "\n")
	var printers []domain.PrinterInfo
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// Expecting: PrinterName   REG_SZ   winspool,Port:
		if idx := strings.Index(line, "REG_SZ"); idx != -1 {
			name := strings.TrimSpace(line[:idx])
			if name != "" {
				printers = append(printers, domain.PrinterInfo{
					Name: name,
				})
			}
		}
	}
	return printers, nil
}

func getPrintersFromWMI() ([]domain.PrinterInfo, error) {
	cmd := exec.Command("powershell", "-NoProfile", "-Command",
		`Get-WmiObject -Class Win32_Printer | Select-Object Name, Default, PrinterStatus, PortName | ForEach-Object { $_.Name }`)

	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	var printers []domain.PrinterInfo
	for _, line := range lines {
		name := strings.TrimSpace(line)
		if name != "" {
			printers = append(printers, domain.PrinterInfo{
				Name: name,
			})
		}
	}

	return printers, nil
}

// GetDefaultPrinter returns the default system printer
func GetDefaultPrinter() (string, error) {
	name, err := getDefaultPrinterFromRegistry()
	if err == nil && name != "" {
		return name, nil
	}
	return getDefaultPrinterFromWMI()
}

func getDefaultPrinterFromRegistry() (string, error) {
	cmd := exec.Command("reg", "query", `HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows`, "/v", "Device")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// Expecting: Device   REG_SZ   PrinterName,winspool,Port:
		if idx := strings.Index(line, "REG_SZ"); idx != -1 {
			val := strings.TrimSpace(line[idx+len("REG_SZ"):])
			if commaIdx := strings.Index(val, ","); commaIdx != -1 {
				name := strings.TrimSpace(val[:commaIdx])
				if name != "" {
					return name, nil
				}
			}
		}
	}
	return "", fmt.Errorf("default printer not found in registry output")
}

func getDefaultPrinterFromWMI() (string, error) {
	cmd := exec.Command("powershell", "-NoProfile", "-Command",
		`(Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Default=$true").Name`)

	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get default printer from WMI: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

// PrintRaw sends raw data directly to a printer (for ESC/POS)
func PrintRaw(printerName string, data []byte) error {
	if isIPAddress(printerName) {
		return PrintRawNetwork(printerName, data)
	}

	pName, err := syscall.UTF16PtrFromString(printerName)
	if err != nil {
		return err
	}

	var hPrinter uintptr
	ret, _, err := procOpenPrinterW.Call(
		uintptr(unsafe.Pointer(pName)),
		uintptr(unsafe.Pointer(&hPrinter)),
		0,
	)
	if ret == 0 {
		return fmt.Errorf("failed to open printer: %v", err)
	}
	defer func() { _, _, _ = procClosePrinter.Call(hPrinter) }()

	docName, _ := syscall.UTF16PtrFromString("Beidar Receipt")
	dataType, _ := syscall.UTF16PtrFromString("RAW")

	type DOC_INFO_1 struct {
		pDocName    *uint16
		pOutputFile *uint16
		pDatatype   *uint16
	}

	docInfo := DOC_INFO_1{
		pDocName:  docName,
		pDatatype: dataType,
	}

	ret, _, err = procStartDocPrinterW.Call(
		hPrinter,
		1,
		uintptr(unsafe.Pointer(&docInfo)),
	)
	if ret == 0 {
		return fmt.Errorf("failed to start document: %v", err)
	}
	defer func() { _, _, _ = procEndDocPrinter.Call(hPrinter) }()

	ret, _, err = procStartPagePrinter.Call(hPrinter)
	if ret == 0 {
		return fmt.Errorf("failed to start page: %v", err)
	}
	defer func() { _, _, _ = procEndPagePrinter.Call(hPrinter) }()

	var written uint32
	ret, _, err = procWritePrinter.Call(
		hPrinter,
		uintptr(unsafe.Pointer(&data[0])),
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&written)),
	)
	if ret == 0 {
		return fmt.Errorf("failed to write to printer: %v", err)
	}

	return nil
}

// ESC/POS Commands
const (
	ESC = 0x1B
	GS  = 0x1D
	FS  = 0x1C
	LF  = 0x0A
)

// utf8ToPC864 converts UTF-8 string to PC864 bytes (DOS Arabic Code Page)
func utf8ToPC864(s string) []byte {
	var res []byte
	for _, r := range s {
		if r < 128 {
			res = append(res, byte(r))
			continue
		}
		switch r {
		case '،':
			res = append(res, 0xAC)
		case '؛':
			res = append(res, 0xBB)
		case '؟':
			res = append(res, 0xBF)
		case 'ء':
			res = append(res, 0xC1)
		case 'آ':
			res = append(res, 0xC2)
		case 'أ':
			res = append(res, 0xC3)
		case 'ؤ':
			res = append(res, 0xC4)
		case 'إ':
			res = append(res, 0xC5)
		case 'ئ':
			res = append(res, 0xC6)
		case 'ا':
			res = append(res, 0xC7)
		case 'ب':
			res = append(res, 0xC8)
		case 'ة':
			res = append(res, 0xC9)
		case 'ت':
			res = append(res, 0xCA)
		case 'ث':
			res = append(res, 0xCB)
		case 'ج':
			res = append(res, 0xCC)
		case 'ح':
			res = append(res, 0xCD)
		case 'خ':
			res = append(res, 0xCE)
		case 'د':
			res = append(res, 0xCF)
		case 'ذ':
			res = append(res, 0xD0)
		case 'ر':
			res = append(res, 0xD1)
		case 'ز':
			res = append(res, 0xD2)
		case 'س':
			res = append(res, 0xD3)
		case 'ش':
			res = append(res, 0xD4)
		case 'ص':
			res = append(res, 0xD5)
		case 'ض':
			res = append(res, 0xD6)
		case 'ط':
			res = append(res, 0xD8)
		case 'ظ':
			res = append(res, 0xD9)
		case 'ع':
			res = append(res, 0xDA)
		case 'غ':
			res = append(res, 0xDB)
		case 'ـ':
			res = append(res, 0xDC)
		case 'ف':
			res = append(res, 0xDD)
		case 'ق':
			res = append(res, 0xDE)
		case 'ك':
			res = append(res, 0xDF)
		case 'ل':
			res = append(res, 0xE1)
		case 'م':
			res = append(res, 0xE3)
		case 'ن':
			res = append(res, 0xE4)
		case 'ه':
			res = append(res, 0xE5)
		case 'و':
			res = append(res, 0xE6)
		case 'ى':
			res = append(res, 0xEC)
		case 'ي':
			res = append(res, 0xED)
		case 'ً':
			res = append(res, 0xF0)
		case 'ٌ':
			res = append(res, 0xF1)
		case 'ٍ':
			res = append(res, 0xF2)
		case 'َ':
			res = append(res, 0xF3)
		case 'ُ':
			res = append(res, 0xF5)
		case 'ِ':
			res = append(res, 0xF6)
		case 'ّ':
			res = append(res, 0xF8)
		case 'ْ':
			res = append(res, 0xFA)
		case 'پ':
			res = append(res, 0x81)
		case 'چ':
			res = append(res, 0x8D)
		case 'ژ':
			res = append(res, 0x8E)
		case 'گ':
			res = append(res, 0x90)
		case '۰':
			res = append(res, '0')
		case '۱':
			res = append(res, '1')
		case '۲':
			res = append(res, '2')
		case '۳':
			res = append(res, '3')
		case '۴':
			res = append(res, '4')
		case '۵':
			res = append(res, '5')
		case '۶':
			res = append(res, '6')
		case '۷':
			res = append(res, '7')
		case '۸':
			res = append(res, '8')
		case '۹':
			res = append(res, '9')
		default:
			res = append(res, '?')
		}
	}
	return res
}

func utf8ToWindows1256(s string) []byte {
	return utf8ToPC864(s)
}

// BuildESCPOSReceipt builds a receipt using ESC/POS commands
func BuildESCPOSReceipt(storeName string, items []domain.ReceiptItem, total float64, currency string) []byte {
	var data []byte

	now := time.Now()
	dateStr := now.Format("2006-01-02")
	timeStr := now.Format("15:04")

	data = append(data, ESC, '@')
	data = append(data, FS, '.')
	data = append(data, ESC, 't', 37)
	data = append(data, ESC, 'R', 14)
	data = append(data, ESC, 'a', 1)
	data = append(data, ESC, 'E', 1)

	// Store name (Large)
	data = append(data, GS, '!', 0x11)
	data = append(data, utf8ToWindows1256(storeName)...)
	data = append(data, LF)
	data = append(data, GS, '!', 0x00)
	data = append(data, LF)

	// Date and Time
	dateLine := fmt.Sprintf("%s  %s", dateStr, timeStr)
	data = append(data, []byte(dateLine)...)
	data = append(data, LF, LF)

	data = append(data, ESC, 'E', 0)
	data = append(data, ESC, 'a', 2)
	data = append(data, []byte("--------------------------------")...)
	data = append(data, LF)

	// Loop items
	for _, item := range items {
		itemName := item.Name
		if len([]rune(itemName)) > 24 {
			itemName = truncateRunes(itemName, 24)
		}
		data = append(data, ESC, 'E', 1)
		data = append(data, utf8ToWindows1256(itemName)...)
		data = append(data, ESC, 'E', 0)
		data = append(data, LF)

		details := fmt.Sprintf("%.0f x %d = %.0f", item.Price, item.Qty, item.Total)
		data = append(data, []byte(details)...)
		data = append(data, LF)
		data = append(data, []byte("----------------")...)
		data = append(data, LF)
	}

	data = append(data, []byte("================================")...)
	data = append(data, LF)

	data = append(data, ESC, 'E', 1)
	totalLabel := utf8ToWindows1256("المجموع")
	data = append(data, totalLabel...)
	data = append(data, []byte(fmt.Sprintf(": %.0f %s", total, currency))...)
	data = append(data, LF, LF)
	data = append(data, ESC, 'E', 0)

	data = append(data, ESC, 'a', 1)
	data = append(data, utf8ToWindows1256("شكرا لزيارتكم")...)
	data = append(data, LF, LF)

	data = append(data, GS, 'V', 66, 3)

	return data
}

func truncateRunes(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen-2]) + ".."
}

// PrintReceipt prints a receipt to the specified printer
func PrintReceipt(printerName, storeName string, items []domain.ReceiptItem, total float64, currency string) error {
	data := BuildESCPOSReceipt(storeName, items, total, currency)
	return PrintRaw(printerName, data)
}

// TestPrinter sends a test page to the printer
func TestPrinter(printerName string) error {
	testData := []byte{
		ESC, '@',
	}

	testData = append(testData, FS, '.')
	testData = append(testData, ESC, 't', 37)
	testData = append(testData, ESC, 'R', 14)
	testData = append(testData, ESC, 'a', 1)
	testData = append(testData, ESC, 'E', 1)

	testData = append(testData, []byte("*** TEST PRINT ***")...)
	testData = append(testData, LF, LF)
	testData = append(testData, []byte("Beidar POS")...)
	testData = append(testData, LF)
	testData = append(testData, utf8ToWindows1256("تجربة طابعة عربية")...)
	testData = append(testData, LF)
	testData = append(testData, utf8ToWindows1256("اختبار الحروف العربية")...)
	testData = append(testData, LF, LF, LF)
	testData = append(testData, GS, 'V', 66, 3)

	return PrintRaw(printerName, testData)
}

// PrintBitmapReceipt prints a receipt image (base64 PNG) directly to thermal printer
func PrintBitmapReceipt(printerName, base64Image string) error {
	if idx := strings.Index(base64Image, ","); idx != -1 {
		base64Image = base64Image[idx+1:]
	}

	imgData, err := base64.StdEncoding.DecodeString(base64Image)
	if err != nil {
		return fmt.Errorf("failed to decode base64 image: %w", err)
	}

	img, _, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		return fmt.Errorf("failed to decode image: %w", err)
	}

	bitmapData := imageToBitmapData(img)

	var data []byte
	data = append(data, ESC, '@')
	data = append(data, FS, '.')
	data = append(data, bitmapData...)
	data = append(data, LF, LF, LF)
	data = append(data, GS, 'V', 66, 3)

	return PrintRaw(printerName, data)
}

func imageToBitmapData(img image.Image) []byte {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	maxWidth := 576
	if width > maxWidth {
		ratio := float64(maxWidth) / float64(width)
		width = maxWidth
		height = int(float64(height) * ratio)
	}

	bytesPerRow := (width + 7) / 8

	var data []byte
	data = append(data, GS, 'v', '0', 0)
	data = append(data, byte(bytesPerRow&0xFF), byte((bytesPerRow>>8)&0xFF))
	data = append(data, byte(height&0xFF), byte((height>>8)&0xFF))

	for y := 0; y < height; y++ {
		for byteX := 0; byteX < bytesPerRow; byteX++ {
			var b byte = 0
			for bit := 0; bit < 8; bit++ {
				pixelX := byteX*8 + bit
				if pixelX < width {
					srcY := y * bounds.Dy() / height
					srcX := pixelX * bounds.Dx() / width
					if srcX >= bounds.Dx() {
						srcX = bounds.Dx() - 1
					}
					if srcY >= bounds.Dy() {
						srcY = bounds.Dy() - 1
					}

					r, g, bl, _ := img.At(srcX+bounds.Min.X, srcY+bounds.Min.Y).RGBA()
					gray := (r + g + bl) / 3
					if gray < 32768 {
						b |= (0x80 >> bit)
					}
				}
			}
			data = append(data, b)
		}
	}

	return data
}

// PrintBitmapReceiptWithPng is an alternative that accepts raw PNG bytes
func PrintBitmapReceiptWithPng(printerName string, pngData []byte) error {
	img, err := png.Decode(bytes.NewReader(pngData))
	if err != nil {
		return fmt.Errorf("failed to decode PNG: %w", err)
	}

	bitmapData := imageToBitmapData(img)

	var data []byte
	data = append(data, ESC, '@')
	data = append(data, FS, '.')
	data = append(data, bitmapData...)
	data = append(data, LF, LF, LF)
	data = append(data, GS, 'V', 66, 3)

	return PrintRaw(printerName, data)
}

func isIPAddress(s string) bool {
	ipStr := s
	if host, _, err := net.SplitHostPort(s); err == nil {
		ipStr = host
	}
	return net.ParseIP(ipStr) != nil
}

func PrintRawNetwork(ipAddress string, data []byte) error {
	host := ipAddress
	if !strings.Contains(ipAddress, ":") {
		host = ipAddress + ":9100"
	}
	conn, err := net.DialTimeout("tcp", host, 5*time.Second)
	if err != nil {
		return fmt.Errorf("failed to connect to network printer at %s: %w", host, err)
	}
	defer conn.Close()

	_, err = conn.Write(data)
	if err != nil {
		return fmt.Errorf("failed to send data to network printer: %w", err)
	}
	return nil
}
