//go:build windows

package autostart

import "testing"

// These tests operate on the real HKCU\...\Run registry key, exactly like the
// production feature does. They always clean up the value afterwards.
func TestAutoStartLifecycle(t *testing.T) {
	t.Cleanup(func() { _ = DisableAutoStart() })

	if IsAutoStartEnabled() {
		t.Log("auto-start already enabled; disabling first for a clean state")
		_ = DisableAutoStart()
	}

	if err := EnableAutoStart(); err != nil {
		t.Fatalf("EnableAutoStart: %v", err)
	}
	if !IsAutoStartEnabled() {
		t.Error("expected auto-start to be enabled after EnableAutoStart")
	}

	path, err := GetAutoStartPath()
	if err != nil {
		t.Fatalf("GetAutoStartPath: %v", err)
	}
	if path == "" {
		t.Error("expected a non-empty autostart path")
	}

	if err := DisableAutoStart(); err != nil {
		t.Fatalf("DisableAutoStart: %v", err)
	}
	if IsAutoStartEnabled() {
		t.Error("expected auto-start to be disabled after DisableAutoStart")
	}
}

func TestDisableAutoStartIsIdempotent(t *testing.T) {
	t.Cleanup(func() { _ = DisableAutoStart() })
	_ = DisableAutoStart()
	if err := DisableAutoStart(); err != nil {
		t.Fatalf("DisableAutoStart when already absent should succeed: %v", err)
	}
	if IsAutoStartEnabled() {
		t.Error("expected auto-start to be disabled")
	}
}
