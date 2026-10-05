package domain

// Actor identifies the authenticated principal an operation runs on behalf of.
//
// Desktop (Wails) operations carry the process-wide staff session. LAN
// operations carry the verified client session — the device identity and role
// established by the LAN token handshake — so authorization never depends on
// whoever happens to be logged in on the server machine.
type Actor struct {
	// Authenticated is false for anonymous callers (no desktop session and no
	// verified LAN session); every permission check fails closed.
	Authenticated bool
	// StaffID is the staff member behind the operation when the principal is a
	// person (desktop session). Empty for device-only LAN sessions.
	StaffID string
	// DeviceID is the verified LAN device identifier; empty for desktop calls.
	DeviceID string
	// Role is the actor's role. Admins always pass permission checks.
	Role Role
	// Permissions is the effective permission set for the actor.
	Permissions []string
}

// HasPermission reports whether the actor holds perm. Anonymous actors never
// pass; admins always pass.
func (a Actor) HasPermission(perm string) bool {
	if !a.Authenticated {
		return false
	}
	if a.Role == RoleAdmin {
		return true
	}
	for _, p := range a.Permissions {
		if p == perm {
			return true
		}
	}
	return false
}
