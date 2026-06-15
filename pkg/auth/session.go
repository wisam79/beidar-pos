// Package auth provides backend-side authentication and authorization for the
// Wails handlers.
//
// Background: Wails v2 does not pass a per-call context.Context to bound methods,
// and the previous design relied entirely on client-side (React) permission
// checks. Any JS in the webview (incl. DevTools) could call any bound method.
//
// Design: Beidar is a desktop POS where a single cashier is active at a time on
// the main window. We therefore keep a single process-wide session (singleton)
// that is populated after a successful login and consulted by every sensitive
// handler method. The package is safe for concurrent use.
package auth

import (
	"errors"
	"fmt"
	"sync"

	"beidar-desktop/internal/core/domain"
)

// Sentinel errors returned by the session checks. They carry JSON-friendly
// codes/messages so the frontend can render localized toasts.
var (
	// ErrNotAuthenticated is returned when no session is active (user not logged in).
	ErrNotAuthenticated = &AuthError{
		Code:    "NOT_AUTHENTICATED",
		Message: "يجب تسجيل الدخول أولاً لتنفيذ هذه العملية",
	}

	// ErrInsufficientPermission is returned when the active session lacks a permission.
	ErrInsufficientPermission = &AuthError{
		Code:    "INSUFFICIENT_PERMISSION",
		Message: "غير مصرح لك بهذه العملية - صلاحيات أعلى مطلوبة",
	}
)

// AuthError is a structured authentication/authorization error.
type AuthError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *AuthError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Is allows errors.Is to match sentinel AuthError values by code.
func (e *AuthError) Is(target error) bool {
	other, ok := target.(*AuthError)
	if !ok {
		return false
	}
	return e.Code == other.Code
}

// SessionSnapshot is an immutable point-in-time copy of the active session.
type SessionSnapshot struct {
	Staff       domain.Staff
	Permissions []string
}

// HasPermission reports whether the snapshot grants the given permission.
// Admins always pass.
func (s SessionSnapshot) HasPermission(perm string) bool {
	if s.Staff.Role == domain.RoleAdmin {
		return true
	}
	for _, p := range s.Permissions {
		if p == perm {
			return true
		}
	}
	return false
}

// state holds the process-wide active session. Guarded by mu.
var (
	state = struct {
		mu    sync.RWMutex
		staff *domain.Staff
		perms []string
	}{}
)

// Set activates the session with the given staff member and permissions.
// The caller should pass the authenticated staff struct (PasswordHash is
// json:"-"). Permissions are cloned to avoid aliasing.
func Set(staff *domain.Staff, permissions []string) {
	permsCopy := make([]string, len(permissions))
	copy(permsCopy, permissions)

	state.mu.Lock()
	defer state.mu.Unlock()
	state.staff = staff
	state.perms = permsCopy
}

// Clear deactivates the session (logout).
func Clear() {
	state.mu.Lock()
	defer state.mu.Unlock()
	state.staff = nil
	state.perms = nil
}

// IsActive reports whether a session is currently active.
func IsActive() bool {
	state.mu.RLock()
	defer state.mu.RUnlock()
	return state.staff != nil
}

// Snapshot returns an immutable copy of the current session. If no session is
// active, ok is false.
func Snapshot() (snap SessionSnapshot, ok bool) {
	state.mu.RLock()
	defer state.mu.RUnlock()
	if state.staff == nil {
		return SessionSnapshot{}, false
	}
	permsCopy := make([]string, len(state.perms))
	copy(permsCopy, state.perms)
	return SessionSnapshot{Staff: *state.staff, Permissions: permsCopy}, true
}

// CurrentStaffID returns the active staff ID, or empty string if none.
func CurrentStaffID() string {
	state.mu.RLock()
	defer state.mu.RUnlock()
	if state.staff == nil {
		return ""
	}
	return state.staff.ID
}

// CurrentRole returns the active staff role, or empty string if none.
func CurrentRole() string {
	state.mu.RLock()
	defer state.mu.RUnlock()
	if state.staff == nil {
		return ""
	}
	return string(state.staff.Role)
}

// CurrentStaffName returns the active staff display name, or empty string if none.
func CurrentStaffName() string {
	state.mu.RLock()
	defer state.mu.RUnlock()
	if state.staff == nil {
		return ""
	}
	return state.staff.Name
}

// Require returns ErrNotAuthenticated when no session is active.
// Use this for methods that need *any* authenticated user but no specific permission.
func Require() error {
	if !IsActive() {
		return ErrNotAuthenticated
	}
	return nil
}

// RequirePermission returns an auth error if no session is active OR the active
// session lacks the given permission. Admins always pass.
func RequirePermission(perm string) error {
	snap, ok := Snapshot()
	if !ok {
		return ErrNotAuthenticated
	}
	if !snap.HasPermission(perm) {
		return ErrInsufficientPermission
	}
	return nil
}

// RequireAdmin returns an auth error unless an admin session is active.
func RequireAdmin() error {
	state.mu.RLock()
	defer state.mu.RUnlock()
	if state.staff == nil {
		return ErrNotAuthenticated
	}
	if state.staff.Role != domain.RoleAdmin {
		return ErrInsufficientPermission
	}
	return nil
}

// AsError unwraps a generic error into a typed *AuthError when possible,
// falling back to ErrNotAuthenticated. Useful when returning errors across
// boundaries where the concrete type may be lost.
func AsError(err error) *AuthError {
	if err == nil {
		return nil
	}
	var ae *AuthError
	if errors.As(err, &ae) {
		return ae
	}
	return ErrNotAuthenticated
}
