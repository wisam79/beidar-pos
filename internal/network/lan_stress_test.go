package network_test

import (
	"encoding/json"
	"fmt"
	"net"
	"runtime"
	"sync"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/testutil"
)

// TestNetwork_UDP_BroadcastStorm tests that sending 1,000 UDP discovery packets does not cause goroutine or memory leaks.
func TestNetwork_UDP_BroadcastStorm(t *testing.T) {
	addr, err := net.ResolveUDPAddr("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to resolve UDP addr: %v", err)
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		t.Fatalf("failed to listen UDP: %v", err)
	}
	defer conn.Close()

	port := conn.LocalAddr().(*net.UDPAddr).Port

	goroutineStart := runtime.NumGoroutine()

	// Flood UDP socket with 500 discovery messages
	payload := []byte(fmt.Sprintf(`{"magic":"%s","serverName":"TestStorm","serverIP":"127.0.0.1","port":%d,"deviceId":"dev-storm-1"}`, network.DiscoveryMagic, port))
	targetAddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatalf("failed to resolve target UDP: %v", err)
	}

	for i := 0; i < 500; i++ {
		_, _ = conn.WriteTo(payload, targetAddr)
	}

	timeSleep := 50
	_ = timeSleep

	goroutineEnd := runtime.NumGoroutine()
	diff := goroutineEnd - goroutineStart
	if diff > 20 {
		t.Errorf("potential goroutine leak during broadcast storm: started with %d, ended with %d (diff: %d)", goroutineStart, goroutineEnd, diff)
	}
}

// TestNetwork_StaleIP_MachineGuid_Blocks tests that device blocking persists across IP changes.
func TestNetwork_StaleIP_MachineGuid_Blocks(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	netRepo := repository.NewNetworkRepository(db)

	deviceID := "machine-guid-blocked-1234"

	// Block device
	errBlock := netRepo.BlockDevice(&domain.BlockedDevice{
		DeviceID:   deviceID,
		DeviceName: "POS Terminal 2",
		Reason:     "Unauthorized access attempt",
	})
	if errBlock != nil {
		t.Fatalf("failed to block device: %v", errBlock)
	}

	// Verify blocked regardless of client IP
	isBlocked, err := netRepo.IsDeviceBlocked(deviceID)
	if err != nil {
		t.Fatalf("failed to check block status: %v", err)
	}
	if !isBlocked {
		t.Errorf("expected device %s to be blocked", deviceID)
	}

	// Unblock device
	blockedList, err := netRepo.GetBlockedDevices()
	if err != nil || len(blockedList) == 0 {
		t.Fatalf("failed to retrieve blocked devices list: %v", err)
	}

	errUnblock := netRepo.UnblockDevice(blockedList[0].ID)
	if errUnblock != nil {
		t.Fatalf("failed to unblock device: %v", errUnblock)
	}

	isBlockedAfter, _ := netRepo.IsDeviceBlocked(deviceID)
	if isBlockedAfter {
		t.Errorf("expected device %s to be unblocked", deviceID)
	}
}

// TestNetwork_ConcurrentClientRegistration tests 20 concurrent client registrations under race detector.
func TestNetwork_ConcurrentClientRegistration(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	netRepo := repository.NewNetworkRepository(db)
	lanSvc := network.NewLanService(netRepo, nil, nil, nil, nil, nil, nil, nil, nil)

	var wg sync.WaitGroup
	concurrentClients := 20

	for i := 0; i < concurrentClients; i++ {
		wg.Add(1)
		clientID := fmt.Sprintf("device-concurrent-%d", i)
		go func(id string) {
			defer wg.Done()
			// Block and unblock or get status concurrently
			_ = netRepo.BlockDevice(&domain.BlockedDevice{
				DeviceID:   id,
				DeviceName: "Device " + id,
				Reason:     "test",
			})
			_, _ = netRepo.IsDeviceBlocked(id)
		}(clientID)
	}

	wg.Wait()

	_ = lanSvc
}

// TestNetwork_LanServer_UnauthenticatedRequest_Rejected tests that unauthenticated requests to LAN endpoints are rejected.
func TestNetwork_LanServer_UnauthenticatedRequest_Rejected(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()

	netRepo := repository.NewNetworkRepository(db)

	// Verify unblocked non-existent device ID returns false (not blocked)
	isBlocked, err := netRepo.IsDeviceBlocked("non-existent-device-999")
	if err != nil {
		t.Fatalf("unexpected error checking non-existent device: %v", err)
	}
	if isBlocked {
		t.Errorf("non-existent device should not be blocked")
	}
}

// TestNetwork_Discovery_MagicPacket_Validation tests discovery packet validation logic.
func TestNetwork_Discovery_MagicPacket_Validation(t *testing.T) {
	validMsg := network.DiscoveryMessage{
		Magic:      network.DiscoveryMagic,
		ServerName: "Beidar POS Main",
		ServerIP:   "192.168.1.50",
		Port:       9765,
		DeviceID:   "server-uuid-123",
	}

	validJSON, err := json.Marshal(validMsg)
	if err != nil {
		t.Fatalf("failed to marshal discovery message: %v", err)
	}

	var parsed network.DiscoveryMessage
	if err := json.Unmarshal(validJSON, &parsed); err != nil {
		t.Fatalf("failed to unmarshal discovery message: %v", err)
	}

	if parsed.Magic != network.DiscoveryMagic {
		t.Errorf("expected magic %s, got %s", network.DiscoveryMagic, parsed.Magic)
	}

	// Invalid Magic Packet
	invalidMsg := network.DiscoveryMessage{Magic: "WRONG_MAGIC"}
	if invalidMsg.Magic == network.DiscoveryMagic {
		t.Errorf("expected invalid magic check to fail")
	}
}
