package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"

	"gorm.io/gorm"
)

func TestNetworkRepo_BlockAndUnblockDevice(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.BlockedDevice{})
	defer cleanup()

	repo := NewNetworkRepository(db)

	dev := &domain.BlockedDevice{
		DeviceID:   "dev-mac-001",
		DeviceName: "Cashier Tablet A",
		BlockedAt:  time.Now().Unix(),
		Reason:     "Unauthorized access attempt",
	}

	// 1. Block Device
	if err := repo.BlockDevice(dev); err != nil {
		t.Fatalf("BlockDevice failed: %v", err)
	}
	if dev.ID == 0 {
		t.Errorf("Expected auto-generated ID for blocked device, got 0")
	}

	// 2. Verify Presence
	blocked, err := repo.IsDeviceBlocked("dev-mac-001")
	if err != nil {
		t.Fatalf("IsDeviceBlocked failed: %v", err)
	}
	if !blocked {
		t.Errorf("Expected device %q to be blocked", dev.DeviceID)
	}

	// 3. Unblock Device
	if err := repo.UnblockDevice(dev.ID); err != nil {
		t.Fatalf("UnblockDevice failed: %v", err)
	}

	// 4. Verify Absence
	blockedAfter, err := repo.IsDeviceBlocked("dev-mac-001")
	if err != nil {
		t.Fatalf("IsDeviceBlocked failed: %v", err)
	}
	if blockedAfter {
		t.Errorf("Expected device %q to NOT be blocked after unblocking", dev.DeviceID)
	}

	// 5. Unblocking nonexistent device returns ErrRecordNotFound
	if err := repo.UnblockDevice(dev.ID); err != gorm.ErrRecordNotFound {
		t.Errorf("Expected gorm.ErrRecordNotFound when unblocking already deleted device, got %v", err)
	}
}

func TestNetworkRepo_IsDeviceBlocked_Accuracy(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.BlockedDevice{})
	defer cleanup()

	repo := NewNetworkRepository(db)

	devices := []*domain.BlockedDevice{
		{DeviceID: "pos-terminal-1", DeviceName: "Front Counter", BlockedAt: time.Now().Unix(), Reason: "Suspicious activity"},
		{DeviceID: "pos-terminal-2", DeviceName: "Back Counter", BlockedAt: time.Now().Unix(), Reason: "Decommissioned"},
	}
	for _, dev := range devices {
		if err := repo.BlockDevice(dev); err != nil {
			t.Fatalf("Failed to block device %s: %v", dev.DeviceID, err)
		}
	}

	tests := []struct {
		deviceID string
		want     bool
	}{
		{"pos-terminal-1", true},
		{"pos-terminal-2", true},
		{"pos-terminal-3", false},
		{"unknown-device", false},
		{"", false},
	}

	for _, tt := range tests {
		got, err := repo.IsDeviceBlocked(tt.deviceID)
		if err != nil {
			t.Fatalf("IsDeviceBlocked(%q) error: %v", tt.deviceID, err)
		}
		if got != tt.want {
			t.Errorf("IsDeviceBlocked(%q) = %v, want %v", tt.deviceID, got, tt.want)
		}
	}
}

func TestNetworkRepo_BlockDuplicateDevice(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.BlockedDevice{})
	defer cleanup()

	repo := NewNetworkRepository(db)

	dev1 := &domain.BlockedDevice{
		DeviceID:   "duplicate-device-id",
		DeviceName: "Original Entry",
		BlockedAt:  time.Now().Unix(),
		Reason:     "First Block",
	}
	if err := repo.BlockDevice(dev1); err != nil {
		t.Fatalf("First BlockDevice failed: %v", err)
	}

	dev2 := &domain.BlockedDevice{
		DeviceID:   "duplicate-device-id",
		DeviceName: "Duplicate Entry",
		BlockedAt:  time.Now().Unix(),
		Reason:     "Second Block Attempt",
	}
	err := repo.BlockDevice(dev2)
	if err == nil {
		t.Fatal("Expected error when blocking duplicate device ID, got nil")
	}

	// Verify only 1 device is stored in DB
	devices, err := repo.GetBlockedDevices()
	if err != nil {
		t.Fatalf("GetBlockedDevices failed: %v", err)
	}
	if len(devices) != 1 {
		t.Errorf("Blocked devices count = %d, want 1", len(devices))
	}
	if devices[0].DeviceName != "Original Entry" {
		t.Errorf("Device name = %q, want 'Original Entry'", devices[0].DeviceName)
	}
}

func TestNetworkRepo_GetBlockedDevices_EmptyAndPopulated(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.BlockedDevice{})
	defer cleanup()

	repo := NewNetworkRepository(db)

	// 1. Check Empty state
	emptyList, err := repo.GetBlockedDevices()
	if err != nil {
		t.Fatalf("GetBlockedDevices on empty DB returned error: %v", err)
	}
	if len(emptyList) != 0 {
		t.Errorf("Expected 0 blocked devices on empty DB, got %d", len(emptyList))
	}

	// 2. Insert devices with staggered BlockedAt timestamps
	d1 := &domain.BlockedDevice{DeviceID: "dev-old", DeviceName: "Old", BlockedAt: 1000, Reason: "Oldest"}
	d2 := &domain.BlockedDevice{DeviceID: "dev-newest", DeviceName: "Newest", BlockedAt: 3000, Reason: "Newest"}
	d3 := &domain.BlockedDevice{DeviceID: "dev-mid", DeviceName: "Mid", BlockedAt: 2000, Reason: "Middle"}

	for _, d := range []*domain.BlockedDevice{d1, d2, d3} {
		if err := repo.BlockDevice(d); err != nil {
			t.Fatalf("BlockDevice failed for %s: %v", d.DeviceID, err)
		}
	}

	// 3. Verify Populated state and descending sort order by BlockedAt
	populated, err := repo.GetBlockedDevices()
	if err != nil {
		t.Fatalf("GetBlockedDevices on populated DB returned error: %v", err)
	}
	if len(populated) != 3 {
		t.Fatalf("Expected 3 blocked devices, got %d", len(populated))
	}

	if populated[0].DeviceID != "dev-newest" || populated[0].BlockedAt != 3000 {
		t.Errorf("First device = %s (time %d), want dev-newest (3000)", populated[0].DeviceID, populated[0].BlockedAt)
	}
	if populated[1].DeviceID != "dev-mid" || populated[1].BlockedAt != 2000 {
		t.Errorf("Second device = %s (time %d), want dev-mid (2000)", populated[1].DeviceID, populated[1].BlockedAt)
	}
	if populated[2].DeviceID != "dev-old" || populated[2].BlockedAt != 1000 {
		t.Errorf("Third device = %s (time %d), want dev-old (1000)", populated[2].DeviceID, populated[2].BlockedAt)
	}
}
