//go:build windows

package print

import (
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
