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

type arabicForm struct {
	isolated rune
	final    rune
	initial  rune
	medial   rune
}

var arabicForms = map[rune]arabicForm{
	'ء': {isolated: 0xFE80, final: 0xFE80, initial: 0xFE80, medial: 0xFE80},
	'آ': {isolated: 0xFE81, final: 0xFE82, initial: 0xFE81, medial: 0xFE82},
	'أ': {isolated: 0xFE83, final: 0xFE84, initial: 0xFE83, medial: 0xFE84},
	'ؤ': {isolated: 0xFE85, final: 0xFE86, initial: 0xFE85, medial: 0xFE86},
	'إ': {isolated: 0xFE87, final: 0xFE88, initial: 0xFE87, medial: 0xFE88},
	'ئ': {isolated: 0xFE89, final: 0xFE8A, initial: 0xFE8B, medial: 0xFE8C},
	'ا': {isolated: 0xFE8D, final: 0xFE8E, initial: 0xFE8D, medial: 0xFE8E},
	'ب': {isolated: 0xFE8F, final: 0xFE90, initial: 0xFE91, medial: 0xFE92},
	'ة': {isolated: 0xFE93, final: 0xFE94, initial: 0xFE93, medial: 0xFE94},
	'ت': {isolated: 0xFE95, final: 0xFE96, initial: 0xFE97, medial: 0xFE98},
	'ث': {isolated: 0xFE99, final: 0xFE9A, initial: 0xFE9B, medial: 0xFE9C},
	'ج': {isolated: 0xFE9D, final: 0xFE9E, initial: 0xFE9F, medial: 0xFEA0},
	'ح': {isolated: 0xFEA1, final: 0xFEA2, initial: 0xFEA3, medial: 0xFEA4},
	'خ': {isolated: 0xFEA5, final: 0xFEA6, initial: 0xFEA7, medial: 0xFEA8},
	'د': {isolated: 0xFEA9, final: 0xFEAA, initial: 0xFEA9, medial: 0xFEAA},
	'ذ': {isolated: 0xFEAB, final: 0xFEAC, initial: 0xFEAB, medial: 0xFEAC},
	'ر': {isolated: 0xFEAD, final: 0xFEAE, initial: 0xFEAD, medial: 0xFEAE},
	'ز': {isolated: 0xFEAF, final: 0xFEB0, initial: 0xFEAF, medial: 0xFEB0},
	'س': {isolated: 0xFEB1, final: 0xFEB2, initial: 0xFEB3, medial: 0xFEB4},
	'ش': {isolated: 0xFEB5, final: 0xFEB6, initial: 0xFEB7, medial: 0xFEB8},
	'ص': {isolated: 0xFEB9, final: 0xFEBA, initial: 0xFEBB, medial: 0xFEBC},
	'ض': {isolated: 0xFEBD, final: 0xFEBE, initial: 0xFEBF, medial: 0xFEC0},
	'ط': {isolated: 0xFEC1, final: 0xFEC2, initial: 0xFEC3, medial: 0xFEC4},
	'ظ': {isolated: 0xFEC5, final: 0xFEC6, initial: 0xFEC7, medial: 0xFEC8},
	'ع': {isolated: 0xFEC9, final: 0xFECA, initial: 0xFECB, medial: 0xFECC},
	'غ': {isolated: 0xFECD, final: 0xFECE, initial: 0xFECF, medial: 0xFED0},
	'ف': {isolated: 0xFED1, final: 0xFED2, initial: 0xFED3, medial: 0xFED4},
	'ق': {isolated: 0xFED5, final: 0xFED6, initial: 0xFED7, medial: 0xFED8},
	'ك': {isolated: 0xFED9, final: 0xFEDA, initial: 0xFEDB, medial: 0xFEDC},
	'ل': {isolated: 0xFEDD, final: 0xFEDE, initial: 0xFEDF, medial: 0xFEE0},
	'م': {isolated: 0xFEE1, final: 0xFEE2, initial: 0xFEE3, medial: 0xFEE4},
	'ن': {isolated: 0xFEE5, final: 0xFEE6, initial: 0xFEE7, medial: 0xFEE8},
	'ه': {isolated: 0xFEE9, final: 0xFEEA, initial: 0xFEEB, medial: 0xFEEC},
	'و': {isolated: 0xFEED, final: 0xFEEE, initial: 0xFEED, medial: 0xFEEE},
	'ى': {isolated: 0xFEEF, final: 0xFEF0, initial: 0xFEEF, medial: 0xFEF0},
	'ي': {isolated: 0xFEF1, final: 0xFEF2, initial: 0xFEF3, medial: 0xFEF4},
}

func isArabic(r rune) bool {
	return (r >= 0x0600 && r <= 0x06FF) || (r >= 0xFE70 && r <= 0xFEFC)
}

func joinsRight(r rune) bool {
	if r == 'ء' || r == 0xFE80 {
		return false
	}
	return isArabic(r)
}

func joinsLeft(r rune) bool {
	switch r {
	case 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'ي', 'ئ':
		return true
	case 'پ', 'چ', 'گ':
		return true
	}
	return false
}

func shapeArabicSegment(segment []rune) []rune {
	if len(segment) == 0 {
		return segment
	}

	// 1. Merge Lam-Alef
	var merged []rune
	for i := 0; i < len(segment); {
		if segment[i] == 'ل' && i+1 < len(segment) {
			next := segment[i+1]
			if next == 'ا' {
				merged = append(merged, 0xFEFB)
				i += 2
				continue
			} else if next == 'أ' {
				merged = append(merged, 0xFEF7)
				i += 2
				continue
			} else if next == 'إ' {
				merged = append(merged, 0xFEF9)
				i += 2
				continue
			} else if next == 'آ' {
				merged = append(merged, 0xFEF5)
				i += 2
				continue
			}
		}
		merged = append(merged, segment[i])
		i++
	}

	// 2. Shape contextually
	shaped := make([]rune, len(merged))
	for i, c := range merged {
		if !isArabic(c) || c == ' ' {
			shaped[i] = c
			continue
		}

		// Lam-Alef ligatures
		if c == 0xFEFB || c == 0xFEF7 || c == 0xFEF9 || c == 0xFEF5 {
			linkRight := (i > 0) && joinsLeft(merged[i-1])
			if linkRight {
				shaped[i] = c + 1 // Final form is U+FEFB+1 = U+FEFC
			} else {
				shaped[i] = c
			}
			continue
		}

		form, hasForm := arabicForms[c]
		if !hasForm {
			shaped[i] = c
			continue
		}

		linkRight := (i > 0) && joinsLeft(merged[i-1]) && joinsRight(c)
		linkLeft := (i < len(merged)-1) && joinsRight(merged[i+1]) && joinsLeft(c)

		if linkRight && linkLeft {
			shaped[i] = form.medial
		} else if linkRight {
			shaped[i] = form.final
		} else if linkLeft {
			shaped[i] = form.initial
		} else {
			shaped[i] = form.isolated
		}
	}

	return shaped
}

func shapeArabicAndBiDi(s string) string {
	runes := []rune(s)
	n := len(runes)
	var result []rune

	for i := 0; i < n; {
		if isArabic(runes[i]) {
			// Find the end of this Arabic run
			j := i
			for j < n {
				if isArabic(runes[j]) {
					j++
				} else if runes[j] == ' ' {
					// Only keep going if there is an Arabic rune ahead
					hasArabicAhead := false
					for k := j + 1; k < n; k++ {
						if isArabic(runes[k]) {
							hasArabicAhead = true
							break
						} else if runes[k] != ' ' {
							break
						}
					}
					if hasArabicAhead {
						j++
					} else {
						break
					}
				} else {
					break
				}
			}

			// Segment from i to j (exclusive) is an Arabic run
			arabicSegment := runes[i:j]
			shaped := shapeArabicSegment(arabicSegment)
			// Reverse the shaped runes
			for l, m := 0, len(shaped)-1; l < m; l, m = l+1, m-1 {
				shaped[l], shaped[m] = shaped[m], shaped[l]
			}
			result = append(result, shaped...)
			i = j
		} else {
			result = append(result, runes[i])
			i++
		}
	}
	return string(result)
}

// utf8ToPC864 converts UTF-8 string to PC864 bytes (DOS Arabic Code Page)
func utf8ToPC864(s string) []byte {
	var res []byte
	for _, r := range s {
		if r < 128 {
			res = append(res, byte(r))
			continue
		}
		switch r {
		// Arabic Presentation Forms-B
		case 0xFE80: res = append(res, 0xC1) // Hamza Isolated
		case 0xFE81: res = append(res, 0xC2) // Alef with Madda Above Isolated
		case 0xFE82: res = append(res, 0xA2) // Alef with Madda Above Final
		case 0xFE83: res = append(res, 0xC3) // Alef with Hamza Above Isolated
		case 0xFE84: res = append(res, 0xA5) // Alef with Hamza Above Final
		case 0xFE85: res = append(res, 0xC4) // Waw with Hamza Above Isolated
		case 0xFE86: res = append(res, 0xC4) // Waw with Hamza Above Final (fallback)
		case 0xFE8B: res = append(res, 0xC6) // Yeh with Hamza Above Initial
		case 0xFE8C: res = append(res, 0xC6) // Yeh with Hamza Above Medial (fallback)
		case 0xFE8D: res = append(res, 0xC7) // Alef Isolated
		case 0xFE8E: res = append(res, 0xA8) // Alef Final
		case 0xFE8F: res = append(res, 0xA9) // Beh Isolated
		case 0xFE90: res = append(res, 0x9E) // Beh Final
		case 0xFE91: res = append(res, 0xC8) // Beh Initial
		case 0xFE92: res = append(res, 0xC8) // Beh Medial (fallback)
		case 0xFE93: res = append(res, 0xC9) // Teh Marbuta Isolated
		case 0xFE94: res = append(res, 0xC9) // Teh Marbuta Final (fallback)
		case 0xFE95: res = append(res, 0xAA) // Teh Isolated
		case 0xFE96: res = append(res, 0xAA) // Teh Final (fallback)
		case 0xFE97: res = append(res, 0xCA) // Teh Initial
		case 0xFE98: res = append(res, 0xCA) // Teh Medial (fallback)
		case 0xFE99: res = append(res, 0xAB) // Theh Isolated
		case 0xFE9A: res = append(res, 0xAB) // Theh Final (fallback)
		case 0xFE9B: res = append(res, 0xCB) // Theh Initial
		case 0xFE9C: res = append(res, 0xCB) // Theh Medial (fallback)
		case 0xFE9D: res = append(res, 0xAD) // Jeem Isolated
		case 0xFE9E: res = append(res, 0xAD) // Jeem Final (fallback)
		case 0xFE9F: res = append(res, 0xCC) // Jeem Initial
		case 0xFEA0: res = append(res, 0xCC) // Jeem Medial (fallback)
		case 0xFEA1: res = append(res, 0xAE) // Hah Isolated
		case 0xFEA2: res = append(res, 0xAE) // Hah Final (fallback)
		case 0xFEA3: res = append(res, 0xCD) // Hah Initial
		case 0xFEA4: res = append(res, 0xCD) // Hah Medial (fallback)
		case 0xFEA5: res = append(res, 0xAF) // Khah Isolated
		case 0xFEA6: res = append(res, 0xAF) // Khah Final (fallback)
		case 0xFEA7: res = append(res, 0xCE) // Khah Initial
		case 0xFEA8: res = append(res, 0xCE) // Khah Medial (fallback)
		case 0xFEA9: res = append(res, 0xCF) // Dal Isolated
		case 0xFEAA: res = append(res, 0xCF) // Dal Final (fallback)
		case 0xFEAB: res = append(res, 0xD0) // Thal Isolated
		case 0xFEAC: res = append(res, 0xD0) // Thal Final (fallback)
		case 0xFEAD: res = append(res, 0xD1) // Reh Isolated
		case 0xFEAE: res = append(res, 0xD1) // Reh Final (fallback)
		case 0xFEAF: res = append(res, 0xD2) // Zain Isolated
		case 0xFEB0: res = append(res, 0xD2) // Zain Final (fallback)
		case 0xFEB1: res = append(res, 0xBC) // Seen Isolated
		case 0xFEB2: res = append(res, 0xBC) // Seen Final (fallback)
		case 0xFEB3: res = append(res, 0xD3) // Seen Initial
		case 0xFEB4: res = append(res, 0xD3) // Seen Medial (fallback)
		case 0xFEB5: res = append(res, 0xBD) // Sheen Isolated
		case 0xFEB6: res = append(res, 0xBD) // Sheen Final (fallback)
		case 0xFEB7: res = append(res, 0xD4) // Sheen Initial
		case 0xFEB8: res = append(res, 0xD4) // Sheen Medial (fallback)
		case 0xFEB9: res = append(res, 0xBE) // Sad Isolated
		case 0xFEBA: res = append(res, 0xBE) // Sad Final (fallback)
		case 0xFEBB: res = append(res, 0xD5) // Sad Initial
		case 0xFEBC: res = append(res, 0xD5) // Sad Medial (fallback)
		case 0xFEBD: res = append(res, 0xEB) // Dad Isolated
		case 0xFEBE: res = append(res, 0xEB) // Dad Final (fallback)
		case 0xFEBF: res = append(res, 0xD6) // Dad Initial
		case 0xFEC0: res = append(res, 0xD6) // Dad Medial (fallback)
		case 0xFEC1: res = append(res, 0xD7) // Tah Isolated
		case 0xFEC2: res = append(res, 0xD7) // Tah Final (fallback)
		case 0xFEC3: res = append(res, 0xD7) // Tah Initial (fallback)
		case 0xFEC4: res = append(res, 0xD7) // Tah Medial (fallback)
		case 0xFEC5: res = append(res, 0xD8) // Zah Isolated
		case 0xFEC6: res = append(res, 0xD8) // Zah Final (fallback)
		case 0xFEC7: res = append(res, 0xD8) // Zah Initial (fallback)
		case 0xFEC8: res = append(res, 0xD8) // Zah Medial (fallback)
		case 0xFEC9: res = append(res, 0xDF) // Ain Isolated
		case 0xFECA: res = append(res, 0xC5) // Ain Final
		case 0xFECB: res = append(res, 0xD9) // Ain Initial
		case 0xFECC: res = append(res, 0xEC) // Ain Medial
		case 0xFECD: res = append(res, 0xEE) // Ghain Isolated
		case 0xFECE: res = append(res, 0xED) // Ghain Final
		case 0xFECF: res = append(res, 0xDA) // Ghain Initial
		case 0xFED0: res = append(res, 0xF7) // Ghain Medial
		case 0xFED1: res = append(res, 0xBA) // Feh Isolated
		case 0xFED2: res = append(res, 0xBA) // Feh Final (fallback)
		case 0xFED3: res = append(res, 0xE1) // Feh Initial
		case 0xFED4: res = append(res, 0xE1) // Feh Medial (fallback)
		case 0xFED5: res = append(res, 0xF8) // Qaf Isolated
		case 0xFED6: res = append(res, 0xF8) // Qaf Final (fallback)
		case 0xFED7: res = append(res, 0xE2) // Qaf Initial
		case 0xFED8: res = append(res, 0xE2) // Qaf Medial (fallback)
		case 0xFED9: res = append(res, 0xFC) // Kaf Isolated
		case 0xFEDA: res = append(res, 0xFC) // Kaf Final (fallback)
		case 0xFEDB: res = append(res, 0xE3) // Kaf Initial
		case 0xFEDC: res = append(res, 0xE3) // Kaf Medial (fallback)
		case 0xFEDD: res = append(res, 0xFB) // Lam Isolated
		case 0xFEDE: res = append(res, 0xFB) // Lam Final (fallback)
		case 0xFEDF: res = append(res, 0xE4) // Lam Initial
		case 0xFEE0: res = append(res, 0xE4) // Lam Medial (fallback)
		case 0xFEE1: res = append(res, 0xEF) // Meem Isolated
		case 0xFEE2: res = append(res, 0xEF) // Meem Final (fallback)
		case 0xFEE3: res = append(res, 0xE5) // Meem Initial
		case 0xFEE4: res = append(res, 0xE5) // Meem Medial (fallback)
		case 0xFEE5: res = append(res, 0xF2) // Noon Isolated
		case 0xFEE6: res = append(res, 0xF2) // Noon Final (fallback)
		case 0xFEE7: res = append(res, 0xE6) // Noon Initial
		case 0xFEE8: res = append(res, 0xE6) // Noon Medial (fallback)
		case 0xFEE9: res = append(res, 0xF3) // Heh Isolated
		case 0xFEEA: res = append(res, 0xF3) // Heh Final (fallback)
		case 0xFEEB: res = append(res, 0xE7) // Heh Initial
		case 0xFEEC: res = append(res, 0xF4) // Heh Medial
		case 0xFEED: res = append(res, 0xE8) // Waw Isolated
		case 0xFEEE: res = append(res, 0xE8) // Waw Final (fallback)
		case 0xFEEF: res = append(res, 0xE9) // Alef Maksura Isolated
		case 0xFEF0: res = append(res, 0xF5) // Alef Maksura Final
		case 0xFEF1: res = append(res, 0xFD) // Yeh Isolated
		case 0xFEF2: res = append(res, 0xF6) // Yeh Final
		case 0xFEF3: res = append(res, 0xEA) // Yeh Initial
		case 0xFEF4: res = append(res, 0xEA) // Yeh Medial (fallback)
		case 0xFEF5: res = append(res, 0x99) // Lam with Alef with Madda Above Isolated
		case 0xFEF6: res = append(res, 0x9A) // Lam with Alef with Madda Above Final
		case 0xFEF7: res = append(res, 0x99) // Lam-Alef with Hamza Above Isolated
		case 0xFEF8: res = append(res, 0x9A) // Lam-Alef with Hamza Above Final
		case 0xFEF9: res = append(res, 0x9D) // Lam-Alef with Hamza Below Isolated (fallback)
		case 0xFEFA: res = append(res, 0x9E) // Lam-Alef with Hamza Below Final (fallback)
		case 0xFEFB: res = append(res, 0x9D) // Lam-Alef Isolated
		case 0xFEFC: res = append(res, 0x9E) // Lam-Alef Final

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
	shaped := shapeArabicAndBiDi(s)
	return utf8ToPC864(shaped)
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
