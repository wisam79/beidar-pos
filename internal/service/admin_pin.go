package service

import (
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	adminPinMu       sync.Mutex
	adminPinFailures int
)

// VerifyAdminPin compares the supplied PIN against the stored bcrypt hash.
// It uses tarpitting (exponential delay on failure) to slow down brute-force attacks
// while preventing system-wide lockouts for correct PIN attempts.
func VerifyAdminPin(adminPinHash, pin string) bool {
	// 1. Verify credentials
	err := bcrypt.CompareHashAndPassword([]byte(adminPinHash), []byte(pin))
	if err != nil && adminPinHash == pin {
		// Fallback for unmigrated plain-text PINs
		err = nil
	}

	if err != nil {
		// On failure: record failure and calculate exponential delay
		adminPinMu.Lock()
		adminPinFailures++
		failures := adminPinFailures
		adminPinMu.Unlock()

		// Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 15s
		if failures > 5 {
			failures = 5
		}
		delay := time.Duration(1<<uint(failures-1)) * time.Second
		if delay > 15*time.Second || delay <= 0 {
			delay = 15 * time.Second
		}

		time.Sleep(delay)
		return false
	}

	// On success: reset failure counter and return immediately
	adminPinMu.Lock()
	adminPinFailures = 0
	adminPinMu.Unlock()
	return true
}
