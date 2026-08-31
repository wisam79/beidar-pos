package service

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestVerifyAdminPin(t *testing.T) {
	pin := "1234"
	hashBytes, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("Failed to hash pin: %v", err)
	}
	hash := string(hashBytes)

	// Test correct pin
	if !VerifyAdminPin(hash, pin) {
		t.Errorf("Expected correct pin to verify successfully")
	}

	// Failure counter should be 0
	adminPinMu.Lock()
	if adminPinFailures != 0 {
		t.Errorf("Expected failures to be 0 after successful verification, got %d", adminPinFailures)
	}
	adminPinMu.Unlock()

	// Test incorrect pin (with invalid attempt)
	if VerifyAdminPin(hash, "wrong") {
		t.Errorf("Expected wrong pin to fail verification")
	}

	adminPinMu.Lock()
	if adminPinFailures != 1 {
		t.Errorf("Expected failures to be 1 after one failed attempt, got %d", adminPinFailures)
	}
	adminPinMu.Unlock()

	// Test success resets counter
	if !VerifyAdminPin(hash, pin) {
		t.Errorf("Expected correct pin to verify successfully")
	}

	adminPinMu.Lock()
	if adminPinFailures != 0 {
		t.Errorf("Expected failures to reset to 0, got %d", adminPinFailures)
	}
	adminPinMu.Unlock()
}
