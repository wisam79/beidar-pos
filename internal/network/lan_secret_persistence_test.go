package network

import (
	"fmt"
	"os"
	"strings"
	"testing"
)

// fakeSecretStore is an in-memory serverSecretStore so tests never read or write
// the real encrypted secureconfig file.
type fakeSecretStore struct {
	value    string
	setCalls int
	failSet  bool
}

func (f *fakeSecretStore) Get() string { return f.value }

func (f *fakeSecretStore) Set(secret string) error {
	f.setCalls++
	if f.failSet {
		return fmt.Errorf("storage unavailable")
	}
	f.value = secret
	return nil
}

// TestServerSecretPersistenceAcrossRestarts pins the LAN pairing fix: the server
// secret must be persisted on first startup and reused afterwards, so already
// paired devices keep working after the app restarts.
func TestServerSecretPersistenceAcrossRestarts(t *testing.T) {
	store := &fakeSecretStore{}

	first := &lanService{secretStore: store}
	if err := first.ensureServerSecret(); err != nil {
		t.Fatalf("ensureServerSecret (first run) failed: %v", err)
	}
	secret := first.GetServerSecret()
	if len(secret) != 32 {
		t.Fatalf("expected a 32 hex char secret, got %q", secret)
	}
	if store.value != secret {
		t.Fatalf("expected the generated secret to be persisted, store has %q", store.value)
	}
	if store.setCalls != 1 {
		t.Fatalf("expected exactly one persist call, got %d", store.setCalls)
	}

	// Simulate an app restart: a fresh service instance sharing the persisted
	// store must reuse the secret instead of generating a new one.
	second := &lanService{secretStore: store}
	if err := second.ensureServerSecret(); err != nil {
		t.Fatalf("ensureServerSecret (second run) failed: %v", err)
	}
	if second.GetServerSecret() != secret {
		t.Fatalf("secret rotated across restart: %q != %q", second.GetServerSecret(), secret)
	}
	if store.setCalls != 1 {
		t.Fatalf("persisted secret must not be regenerated, persist calls = %d", store.setCalls)
	}
}

// TestServerSecretRotationPersists verifies explicit rotation (operator action)
// stores the new value and invalidates the old one.
func TestServerSecretRotationPersists(t *testing.T) {
	store := &fakeSecretStore{}
	svc := &lanService{secretStore: store}

	first, err := svc.GenerateServerSecret()
	if err != nil {
		t.Fatalf("first generation failed: %v", err)
	}
	second, err := svc.GenerateServerSecret()
	if err != nil {
		t.Fatalf("rotation failed: %v", err)
	}
	if first == second {
		t.Fatalf("rotation must produce a new secret, got %q twice", first)
	}
	if store.value != second {
		t.Fatalf("rotated secret must be persisted, store has %q", store.value)
	}
	if !svc.ValidateServerSecret(second) {
		t.Fatal("rotated secret must validate")
	}
	if svc.ValidateServerSecret(first) {
		t.Fatal("old secret must stop validating after rotation")
	}
}

// TestServerSecretGenerationSurvivesStoreFailure keeps LAN usable for the
// current run even when persistence fails (the failure is logged, not fatal).
func TestServerSecretGenerationSurvivesStoreFailure(t *testing.T) {
	store := &fakeSecretStore{failSet: true}
	svc := &lanService{secretStore: store}

	secret, err := svc.GenerateServerSecret()
	if err != nil {
		t.Fatalf("generation must not fail when persistence fails: %v", err)
	}
	if secret == "" || svc.GetServerSecret() != secret {
		t.Fatal("secret must stay available in memory for this run")
	}
	if store.value != "" {
		t.Fatal("store must not have accepted the value")
	}
}

// TestFileServerSecretStoreRoundTrip exercises the real encrypted file store in
// an isolated config directory (APPDATA/XDG_CONFIG_HOME are redirected here), so
// the developer's own config is never touched.
func TestFileServerSecretStoreRoundTrip(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("APPDATA", tmp)
	t.Setenv("XDG_CONFIG_HOME", tmp)

	store := fileServerSecretStore{}
	if got := store.Get(); got != "" {
		t.Fatalf("expected no stored secret initially, got %q", got)
	}

	if err := store.Set("abc123"); err != nil {
		t.Fatalf("Set failed: %v", err)
	}
	if got := store.Get(); got != "abc123" {
		t.Fatalf("round-trip mismatch: got %q", got)
	}

	data, err := os.ReadFile(serverSecretFilePath())
	if err != nil {
		t.Fatalf("expected the secret file to exist: %v", err)
	}
	if strings.Contains(string(data), "abc123") {
		t.Fatal("secret must never be stored in plaintext")
	}
}

// TestReconnectSavedServerNoopWithoutPairingData pins that auto-reconnect never
// performs any network work without a saved client session.
func TestReconnectSavedServerNoopWithoutPairingData(t *testing.T) {
	svc := &lanService{}
	svc.reconnectSavedServer()

	if svc.IsClientMode() {
		t.Fatal("anonymous service must not enter client mode")
	}
	if svc.GetServerSecret() != "" {
		t.Fatal("auto-reconnect must not create a server secret")
	}
}
