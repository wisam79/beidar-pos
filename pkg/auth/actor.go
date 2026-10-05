package auth

import "beidar-desktop/internal/core/domain"

// CurrentActor returns the actor for the process-wide desktop session.
// The returned actor is anonymous when no session is active or when the
// session expired, so permission checks fail closed.
func CurrentActor() domain.Actor {
	snap, ok := Snapshot()
	if !ok {
		return domain.Actor{}
	}
	return domain.Actor{
		Authenticated: true,
		StaffID:       snap.Staff.ID,
		Role:          snap.Staff.Role,
		Permissions:   snap.Permissions,
	}
}

// RequirePermissionFor enforces perm against an explicit actor instead of the
// process-wide session. Use it when the principal is not the local desktop user
// (e.g. a verified LAN device session), so the decision follows the caller
// rather than whoever is logged in on this machine.
func RequirePermissionFor(actor domain.Actor, perm string) error {
	if !actor.Authenticated {
		return ErrNotAuthenticated
	}
	if !actor.HasPermission(perm) {
		return ErrInsufficientPermission
	}
	return nil
}
