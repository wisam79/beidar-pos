//go:build windows

package print

import (
	"image"
	"image/color"
	"net"
	"testing"
	"time"
)

func TestIsIPAddress(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"192.168.1.100", true},
		{"192.168.1.100:9100", true},
		{"127.0.0.1", true},
		{"127.0.0.1:9100", true},
		{"::1", true},
		{"localhost", false},
		{"My Thermal Printer", false},
		{"192.168.1", false},
	}

	for _, test := range tests {
		result := isIPAddress(test.input)
		if result != test.expected {
			t.Errorf("isIPAddress(%q) = %v; expected %v", test.input, result, test.expected)
		}
	}
}

func TestPrintRawNetwork(t *testing.T) {
	// Start a local TCP listener to mock a network printer
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start mock listener: %v", err)
	}
	defer listener.Close()

	addr := listener.Addr().String()
	testData := []byte("Hello Printer!")

	errChan := make(chan error, 1)
	receivedData := make([]byte, len(testData))

	// Run mock printer server
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			errChan <- err
			return
		}
		defer conn.Close()

		_, err = conn.Read(receivedData)
		if err != nil {
			errChan <- err
			return
		}
		errChan <- nil
	}()

	// Send data using PrintRawNetwork
	err = PrintRawNetwork(addr, testData)
	if err != nil {
		t.Fatalf("PrintRawNetwork failed: %v", err)
	}

	// Wait for mock printer to receive data
	select {
	case err := <-errChan:
		if err != nil {
			t.Fatalf("mock printer failed: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for print data")
	}

	if string(receivedData) != string(testData) {
		t.Errorf("received %q, expected %q", string(receivedData), string(testData))
	}
}

func TestPrintRawRouting(t *testing.T) {
	// Start a local TCP listener to mock network printer routing
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start mock listener: %v", err)
	}
	defer listener.Close()

	addr := listener.Addr().String()
	testData := []byte("Routing Test")

	errChan := make(chan error, 1)
	receivedData := make([]byte, len(testData))

	go func() {
		conn, err := listener.Accept()
		if err != nil {
			errChan <- err
			return
		}
		defer conn.Close()

		_, err = conn.Read(receivedData)
		if err != nil {
			errChan <- err
			return
		}
		errChan <- nil
	}()

	// PrintRaw should route to network printer because address is IP
	err = PrintRaw(addr, testData)
	if err != nil {
		t.Fatalf("PrintRaw routing to network failed: %v", err)
	}

	select {
	case err := <-errChan:
		if err != nil {
			t.Fatalf("mock printer failed: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for print routing")
	}

	if string(receivedData) != string(testData) {
		t.Errorf("routed data mismatch: received %q, expected %q", string(receivedData), string(testData))
	}
}

func TestGetAvailablePrinters(t *testing.T) {
	printers, err := GetAvailablePrinters()
	if err != nil {
		t.Fatalf("GetAvailablePrinters failed: %v", err)
	}
	t.Logf("Found %d available printers", len(printers))
	for i, p := range printers {
		t.Logf("  Printer %d: %s", i+1, p.Name)
	}
}

func TestGetDefaultPrinter(t *testing.T) {
	printer, err := GetDefaultPrinter()
	if err != nil {
		t.Fatalf("GetDefaultPrinter failed: %v", err)
	}
	t.Logf("Default printer: %q", printer)
}

func TestImageToBitmapData(t *testing.T) {
	// 100x50 white image -> all bits should be 0 (white)
	white := image.NewRGBA(image.Rect(0, 0, 100, 50))
	for i := range white.Pix {
		white.Pix[i] = 255
	}
	bitmap, err := imageToBitmapData(white)
	if err != nil {
		t.Fatalf("imageToBitmapData(white) failed: %v", err)
	}
	expectedLen := 8 + (100+7)/8*50 // GS v 0 header (4) + dimensions (4) + raster rows
	if len(bitmap) != expectedLen {
		t.Fatalf("white bitmap length = %d, expected %d", len(bitmap), expectedLen)
	}
	for _, b := range bitmap[8:] {
		if b != 0 {
			t.Fatalf("white image produced non-zero raster byte 0x%02x", b)
		}
	}

	// 7x7 black image -> single byte per row, all bits set for the 7 pixels
	black := image.NewRGBA(image.Rect(0, 0, 7, 7))
	for i := range black.Pix {
		black.Pix[i] = 0
	}
	bitmap, err = imageToBitmapData(black)
	if err != nil {
		t.Fatalf("imageToBitmapData(black) failed: %v", err)
	}
	if len(bitmap) != 8+7 {
		t.Fatalf("black bitmap length = %d, expected %d", len(bitmap), 8+7)
	}
	for _, b := range bitmap[8:] {
		if b != 0xFE { // 0b11111110: 7 pixels set in the low 7 bits
			t.Fatalf("black image produced unexpected raster byte 0x%02x", b)
		}
	}

	// Oversized height must be rejected
	tall := image.NewRGBA(image.Rect(0, 0, 10, maxBitmapHeight+1))
	if _, err := imageToBitmapData(tall); err == nil {
		t.Fatal("expected error for oversized image height")
	}

	// Empty image must be rejected
	empty := image.NewRGBA(image.Rect(0, 0, 0, 0))
	if _, err := imageToBitmapData(empty); err == nil {
		t.Fatal("expected error for empty image")
	}

	// Color image must not panic and must round-trip length
	colorImg := image.NewRGBA(image.Rect(0, 0, 600, 40))
	for y := 0; y < 40; y++ {
		for x := 0; x < 600; x++ {
			colorImg.Set(x, y, color.RGBA{R: uint8(x % 255), G: 128, B: 30, A: 255})
		}
	}
	bitmap, err = imageToBitmapData(colorImg)
	if err != nil {
		t.Fatalf("imageToBitmapData(color) failed: %v", err)
	}
	if len(bitmap) < 4 {
		t.Fatalf("color bitmap too short: %d", len(bitmap))
	}
}
