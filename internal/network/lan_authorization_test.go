package network

import (
	"net/http"
	"testing"

	"beidar-desktop/internal/core/domain"
)

func TestLANRoleAuthorizationPolicy(t *testing.T) {
	tests := []struct {
		name   string
		role   domain.Role
		method string
		path   string
		allow  bool
	}{
		{"admin can manage devices", domain.RoleAdmin, http.MethodPost, "/api/admin/clients", true},
		{"cashier can read products", domain.RoleCashier, http.MethodGet, "/api/products", true},
		{"cashier can process sales", domain.RoleCashier, http.MethodPost, "/api/sales/process", true},
		{"cashier cannot export database", domain.RoleCashier, http.MethodGet, "/api/database/export", false},
		{"cashier cannot delete sales", domain.RoleCashier, http.MethodDelete, "/api/sales", false},
		{"manager can adjust stock", domain.RoleManager, http.MethodPost, "/api/stock/movements", true},
		{"manager cannot manage LAN clients", domain.RoleManager, http.MethodPost, "/api/admin/clients", false},
		{"viewer has no LAN API access", domain.RoleViewer, http.MethodGet, "/api/products", false},
		{"unknown path fails closed", domain.RoleCashier, http.MethodGet, "/api/future-route", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := lanRoleAllows(tt.role, tt.method, tt.path); got != tt.allow {
				t.Fatalf("lanRoleAllows(%q, %s, %s) = %v, want %v", tt.role, tt.method, tt.path, got, tt.allow)
			}
		})
	}
}
