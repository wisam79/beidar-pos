//go:build windows

package print

import (
	"beidar-desktop/internal/core/domain"
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"net"
	"strings"
	"syscall"
	"time"
	"unsafe"

	_ "image/gif"
	_ "image/jpeg"
)

var (
	winspool              = syscall.NewLazyDLL("winspool.drv")
	procOpenPrinterW      = winspool.NewProc("OpenPrinterW")
	procClosePrinter      = winspool.NewProc("ClosePrinter")
	procStartDocPrinterW  = winspool.NewProc("StartDocPrinterW")
	procEndDocPrinter     = winspool.NewProc("EndDocPrinter")
	procStartPagePrinter  = winspool.NewProc("StartPagePrinter")
	procEndPagePrinter    = winspool.NewProc("EndPagePrinter")
	procWritePrinter      = winspool.NewProc("WritePrinter")
	procEnumPrintersW     = winspool.NewProc("EnumPrintersW")
	procGetDefaultPrinter = winspool.NewProc("GetDefaultPrinterW")
)

const (
	PRINTER_ENUM_LOCAL       = 0x00000002
	PRINTER_ENUM_CONNECTIONS = 0x00000004

	// errorInsufficientBuffer is returned by the size-query calls of
	// EnumPrintersW/GetDefaultPrinterW and signals that a buffer is required.
	errorInsufficientBuffer = syscall.Errno(122)

	// spoolerCallTimeout bounds how long a single direct print job may block
	// on the Windows spooler before we report a timeout to the caller instead
	// of freezing the Wails method forever.
	spoolCallTimeout = 20 * time.Second

	// maxBitmapImageBytes caps the decoded receipt image payload (a receipt at
	// 2x pixel ratio is typically well under 5 MB).
	maxBitmapImageBytes = 20 << 20

	// maxBitmapHeight caps the bitmap print height in dots to avoid generating
	// absurdly large ESC/POS jobs for malformed or hostile inputs.
	maxBitmapHeight = 30000
)

// runWithTimeout executes fn in a goroutine and returns its error, falling back
// to a timeout error if the underlying printer call blocks for too long.
func runWithTimeout(timeout time.Duration, fn func() error) error {
	errCh := make(chan error, 1)
	go func() { errCh <- fn() }()
	select {
	case err := <-errCh:
		return err
	case <-time.After(timeout):
		return fmt.Errorf("طباعة: انتهت مهلة التنفيذ بعد %v", timeout.Round(time.Second))
	}
}

// GetAvailablePrinters returns the list of installed printers. It uses the
// native EnumPrintersW API instead of spawning reg.exe / powershell.exe
// subprocesses (which were slow and locale-dependent).
func GetAvailablePrinters() ([]domain.PrinterInfo, error) {
	names, err := enumPrinterNames()
	if err != nil {
		return nil, err
	}
	printers := make([]domain.PrinterInfo, 0, len(names))
	for _, name := range names {
		printers = append(printers, domain.PrinterInfo{Name: name})
	}
	return printers, nil
}

// printerInfo2 mirrors the Win32 PRINTER_INFO_2 structure (Level 2) used by
// EnumPrintersW. Field order and widths must match the native layout.
type printerInfo2 struct {
	pServerName         *uint16
	pPrinterName        *uint16
	pShareName          *uint16
	pPortName           *uint16
	pDriverName         *uint16
	pComment            *uint16
	pLocation           *uint16
	pDevMode            uintptr
	pSepFile            *uint16
	pPrintProcessor     *uint16
	pDatatype           *uint16
	pParameters         *uint16
	pSecurityDescriptor uintptr
	Attributes          uint32
	Priority            uint32
	DefaultPriority     uint32
	StartTime           uint32
	UntilTime           uint32
	Status              uint32
	cJobs               uint32
	AveragePPM          uint32
}

func enumPrinterNames() ([]string, error) {
	flags := uintptr(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS)
	var needed, returned uint32

	// Size-query call: fails with ERROR_INSUFFICIENT_BUFFER and reports the
	// required buffer size in `needed`.
		_, _, _ = procEnumPrintersW.Call(
		flags, 0, 2, 0, 0,
		uintptr(unsafe.Pointer(&needed)),
		uintptr(unsafe.Pointer(&returned)),
	)
	if needed == 0 {
		// No printers installed or spooler unavailable.
		return nil, nil
	}

	buf := make([]byte, needed)
	ret, _, err := procEnumPrintersW.Call(
		flags, 0, 2,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(needed),
		uintptr(unsafe.Pointer(&needed)),
		uintptr(unsafe.Pointer(&returned)),
	)
	if ret == 0 {
		return nil, fmt.Errorf("failed to enumerate printers: %v", err)
	}

	const size = unsafe.Sizeof(printerInfo2{})
	names := make([]string, 0, returned)
	for i := uint32(0); i < returned; i++ {
		info := (*printerInfo2)(unsafe.Add(unsafe.Pointer(&buf[0]), uintptr(i)*size))
		if name := utf16PtrToString(info.pPrinterName); name != "" {
			names = append(names, name)
		}
	}
	return names, nil
}

// GetDefaultPrinter returns the default system printer via the native
// GetDefaultPrinterW API (no subprocess spawning).
func GetDefaultPrinter() (string, error) {
	return getDefaultPrinterNative()
}

func getDefaultPrinterNative() (string, error) {
	var size uint32
	_, _, err := procGetDefaultPrinter.Call(0, uintptr(unsafe.Pointer(&size)))
	if err != nil {
		// A real default printer is announced via ERROR_INSUFFICIENT_BUFFER
		// plus the required size; anything else means no default is set.
		if errno, ok := err.(syscall.Errno); !ok || errno != errorInsufficientBuffer || size == 0 {
			return "", fmt.Errorf("no default printer configured")
		}
	}
	if size == 0 {
		return "", fmt.Errorf("no default printer configured")
	}

	buf := make([]uint16, size)
	ret, _, err := procGetDefaultPrinter.Call(
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if ret == 0 {
		return "", fmt.Errorf("failed to query default printer: %v", err)
	}
	name := syscall.UTF16ToString(buf)
	if name == "" {
		return "", fmt.Errorf("no default printer configured")
	}
	return name, nil
}

func utf16PtrToString(p *uint16) string {
	if p == nil {
		return ""
	}
	base := unsafe.Pointer(p)
	var s []uint16
	for i := 0; ; i++ {
		c := *(*uint16)(unsafe.Add(base, uintptr(i)*2))
		if c == 0 {
			break
		}
		s = append(s, c)
	}
	return syscall.UTF16ToString(s)
}

// PrintRaw sends raw data directly to a printer (for ESC/POS)
func PrintRaw(printerName string, data []byte) error {
	if isIPAddress(printerName) {
		return PrintRawNetwork(printerName, data)
	}
	return runWithTimeout(spoolCallTimeout, func() error {
		return printRawSpooler(printerName, data)
	})
}

func printRawSpooler(printerName string, data []byte) error {
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

// TestPrinter sends an ASCII test page to the printer (connectivity check only).
// Arabic text is intentionally avoided here: Arabic thermal printing is handled
// exclusively via the bitmap pipeline (PrintBitmapReceipt).
func TestPrinter(printerName string) error {
	testData := []byte{
		ESC, '@',
		FS, '.',
		ESC, 't', 37,
		ESC, 'R', 14,
		ESC, 'a', 1,
		ESC, 'E', 1,
		'*', '*', '*', ' ', 'T', 'E', 'S', 'T', ' ', 'P', 'R', 'I', 'N', 'T', '*', '*', '*',
		LF, LF,
		'B', 'e', 'i', 'd', 'a', 'r', ' ', 'P', 'O', 'S',
		LF, LF, LF,
		GS, 'V', 66, 3,
	}

	return PrintRaw(printerName, testData)
}

// PrintBitmapReceipt prints a receipt image (base64 PNG) directly to a thermal
// printer using the raster (GS v 0) command. The image is size-capped to keep
// malformed or enormous payloads from exhausting memory or generating huge jobs.
func PrintBitmapReceipt(printerName, base64Image string) error {
	if idx := strings.Index(base64Image, ","); idx != -1 {
		base64Image = base64Image[idx+1:]
	}

	imgData, err := base64.StdEncoding.DecodeString(base64Image)
	if err != nil {
		return fmt.Errorf("failed to decode base64 image: %w", err)
	}
	if len(imgData) > maxBitmapImageBytes {
		return fmt.Errorf("image payload too large (%d bytes, limit %d bytes)", len(imgData), maxBitmapImageBytes)
	}

	img, _, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		return fmt.Errorf("failed to decode image: %w", err)
	}

	bitmapData, err := imageToBitmapData(img)
	if err != nil {
		return err
	}

	var data []byte
	data = append(data, ESC, '@')
	data = append(data, FS, '.')
	data = append(data, bitmapData...)
	data = append(data, LF, LF, LF)
	data = append(data, GS, 'V', 66, 3)

	return PrintRaw(printerName, data)
}

// imageToBitmapData converts an image into ESC/POS raster bitmap bytes (GS v 0).
// It downscales to maxBitmapWidth with error-diffusion dithering so thin text
// strokes survive at 1-bit depth.
func imageToBitmapData(img image.Image) ([]byte, error) {
	const maxWidth = 576

	bounds := img.Bounds()
	srcW, srcH := bounds.Dx(), bounds.Dy()
	if srcW <= 0 || srcH <= 0 {
		return nil, fmt.Errorf("image has empty bounds")
	}
	if srcH > maxBitmapHeight {
		return nil, fmt.Errorf("image height %d exceeds limit %d", srcH, maxBitmapHeight)
	}

	width, height := srcW, srcH
	if width > maxWidth {
		ratio := float64(maxWidth) / float64(width)
		width = maxWidth
		height = int(float64(srcH) * ratio)
		if height < 1 {
			height = 1
		}
	}
	if height > maxBitmapHeight {
		return nil, fmt.Errorf("scaled image height %d exceeds limit %d", height, maxBitmapHeight)
	}

	// Downsample to an 8-bit grayscale grid (0..255).
	gray := make([]float64, width*height)
	for y := 0; y < height; y++ {
		srcY := y * srcH / height
		if srcY >= srcH {
			srcY = srcH - 1
		}
		row := gray[y*width : (y+1)*width]
		for x := 0; x < width; x++ {
			srcX := x * srcW / width
			if srcX >= srcW {
				srcX = srcW - 1
			}
			r, g, b, _ := img.At(srcX+bounds.Min.X, srcY+bounds.Min.Y).RGBA()
			row[x] = float64((r+g+b)/3) / 257.0
		}
	}

	// Floyd–Steinberg error diffusion to preserve thin strokes at 1-bit depth.
	bytesPerRow := (width + 7) / 8
	bitmap := make([]byte, bytesPerRow*height)
	for y := 0; y < height; y++ {
		row := gray[y*width : (y+1)*width]
		for x := 0; x < width; x++ {
			p := row[x]
			if p < 0 {
				p = 0
			} else if p > 255 {
				p = 255
			}
			quantized := 255.0
			if p < 128 {
				quantized = 0
			}
			err := p - quantized
			if x+1 < width {
				row[x+1] += err * 7 / 16
			}
			if y+1 < height {
				next := gray[(y+1)*width : (y+2)*width]
				if x > 0 {
					next[x-1] += err * 3 / 16
				}
				next[x] += err * 5 / 16
				if x+1 < width {
					next[x+1] += err * 1 / 16
				}
			}
			if quantized == 0 {
				bitmap[y*bytesPerRow+x/8] |= 0x80 >> (x % 8)
			}
		}
	}

	var data []byte
	data = append(data, GS, 'v', '0', 0)
	data = append(data, byte(bytesPerRow&0xFF), byte((bytesPerRow>>8)&0xFF))
	data = append(data, byte(height&0xFF), byte((height>>8)&0xFF))
	data = append(data, bitmap...)

	return data, nil
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

	// Never let a stuck socket block the caller forever (mirrors spoolCallTimeout).
	_ = conn.SetWriteDeadline(time.Now().Add(spoolCallTimeout))

	_, err = conn.Write(data)
	if err != nil {
		return fmt.Errorf("failed to send data to network printer: %w", err)
	}
	return nil
}
