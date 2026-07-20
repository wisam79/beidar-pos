package service

import (
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	maxAdminPinAttempts = 5
	adminPinWindow      = 15 * time.Minute
)

var (
	adminPinMu          sync.Mutex
	adminPinAttempts    int
	adminPinWindowStart time.Time
)

// checkAdminPinRateLimit returns false if too many failures within the window.
func checkAdminPinRateLimit() bool {
	adminPinMu.Lock()
	defer adminPinMu.Unlock()

	if adminPinAttempts >= maxAdminPinAttempts {
		if time.Since(adminPinWindowStart) < adminPinWindow {
			return false
		}
	}
	return true
}

func recordAdminPinFailure() {
	adminPinMu.Lock()
	defer adminPinMu.Unlock()

	if adminPinAttempts == 0 || time.Since(adminPinWindowStart) >= adminPinWindow {
		adminPinAttempts = 1
		adminPinWindowStart = time.Now()
		return
	}
	adminPinAttempts++
	if adminPinAttempts >= maxAdminPinAttempts {
		adminPinWindowStart = time.Now()
	}
}

func resetAdminPinRateLimit() {
	adminPinMu.Lock()
	defer adminPinMu.Unlock()
	adminPinAttempts = 0
	adminPinWindowStart = time.Time{}
}

// VerifyAdminPin compares the supplied PIN against the stored bcrypt hash.
// Returns true on match. A per-window rate limit of maxAdminPinAttempts is
// enforced to slow brute-force.
func VerifyAdminPin(adminPinHash, pin string) bool {
	if !checkAdminPinRateLimit() {
		return false
	}

	if err := bcrypt.CompareHashAndPassword([]byte(adminPinHash), []byte(pin)); err != nil {
		recordAdminPinFailure()
		return false
	}
	resetAdminPinRateLimit()
	return true
}
