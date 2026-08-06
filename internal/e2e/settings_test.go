package e2e

import (
	"testing"

	"beidar-desktop/internal/core/domain"
)

func TestE2E_UpdateAndVerifyAdminPin(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	h.LoginAsAdmin(t)
	defer h.DeferLogout()

	// Set an admin PIN through preferences update.
	prefs, err := h.SettingsHandler.GetPreferences()
	if err != nil {
		t.Fatalf("GetPreferences failed: %v", err)
	}
	prefs.AdminPin = "8642"
	if err := h.SettingsHandler.UpdatePreferences(*prefs); err != nil {
		t.Fatalf("UpdatePreferences failed: %v", err)
	}

	if !h.SettingsHandler.VerifyAdminPin("8642") {
		t.Error("VerifyAdminPin should accept the correct PIN")
	}
	if h.SettingsHandler.VerifyAdminPin("0000") {
		t.Error("VerifyAdminPin should reject a wrong PIN")
	}

	// Preferences persisted (store name survives).
	got, err := h.SettingsHandler.GetPreferences()
	if err != nil {
		t.Fatalf("GetPreferences failed: %v", err)
	}
	if got.StoreName == "" {
		t.Error("store name should be persisted")
	}
}

func TestE2E_UpdatePreferencesRequiresSettingsPermission(t *testing.T) {
	h, cleanup := NewHarness(t)
	defer cleanup()

	// Create and login a cashier (no settings permission).
	h.LoginAsAdmin(t)
	_, err := h.StaffHandler.CreateStaff(domain.Staff{
		Name:     "كاشير إعدادات",
		Username: "cashier_settings",
		Role:     domain.RoleCashier,
		Active:   true,
	}, "8306")
	if err != nil {
		t.Fatalf("create cashier failed: %v", err)
	}
	h.StaffHandler.Logout()

	result, err := h.StaffHandler.AuthenticateByUsername("cashier_settings", "8306")
	if err != nil {
		t.Fatalf("cashier login failed: %v", err)
	}
	if !result.Success {
		t.Fatalf("cashier login failed: %s", result.Message)
	}
	defer h.DeferLogout()

	err = h.SettingsHandler.UpdatePreferences(domain.AppPreferences{StoreName: "محاولة غير مصرح"})
	if err == nil {
		t.Fatal("cashier must not update settings")
	}
}