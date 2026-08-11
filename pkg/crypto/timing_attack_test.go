package crypto_test

import (
	"crypto/subtle"
	"encoding/json"
	"math"
	"testing"
	"time"

	"beidar-desktop/pkg/crypto"
)

// TestCrypto_TimingAttackResistance tests timing side-channel protection properties.
func TestCrypto_TimingAttackResistance(t *testing.T) {
	correctToken := "beidar_secret_admin_session_token_998877"
	almostCorrectToken := "beidar_secret_admin_session_token_998878" // 1 char diff
	completelyWrongToken := "xyz_totally_unrelated_token_value_0000"

	// Warmup
	for i := 0; i < 50; i++ {
		_ = subtle.ConstantTimeCompare([]byte(correctToken), []byte(almostCorrectToken))
	}

	iterations := 200

	var durationAlmost int64
	for i := 0; i < iterations; i++ {
		start := time.Now().UnixNano()
		_ = subtle.ConstantTimeCompare([]byte(correctToken), []byte(almostCorrectToken))
		durationAlmost += (time.Now().UnixNano() - start)
	}

	var durationWrong int64
	for i := 0; i < iterations; i++ {
		start := time.Now().UnixNano()
		_ = subtle.ConstantTimeCompare([]byte(correctToken), []byte(completelyWrongToken))
		durationWrong += (time.Now().UnixNano() - start)
	}

	avgAlmost := float64(durationAlmost) / float64(iterations)
	avgWrong := float64(durationWrong) / float64(iterations)

	diff := math.Abs(avgAlmost - avgWrong)
	t.Logf("Timing resistance: avgAlmost=%.2fns, avgWrong=%.2fns, diff=%.2fns", avgAlmost, avgWrong, diff)

	// Ensure execution time difference is negligible
	if diff > 5000 { // 5 microseconds tolerance
		t.Errorf("Potential timing leak detected: time difference %.2fns > threshold 5000ns", diff)
	}
}

// TestCrypto_MachineBoundDecryption_FailsOnMove tests that encrypted secrets cannot be decrypted with a different key.
func TestCrypto_MachineBoundDecryption_FailsOnMove(t *testing.T) {
	keyMachineA := crypto.DeriveKey("machine-guid-device-aaa-111")
	keyMachineB := crypto.DeriveKey("machine-guid-device-bbb-222")

	secretsPayload := map[string]string{
		"gemini_api_key": "AIzaSyTestKeyForGeminiAPI123456",
		"groq_api_key":   "gsk_test_groq_key_9876543210",
	}

	rawJSON, err := json.Marshal(secretsPayload)
	if err != nil {
		t.Fatalf("failed to marshal secrets: %v", err)
	}

	// Encrypt with Machine A key
	ciphertext, err := crypto.Encrypt(rawJSON, keyMachineA)
	if err != nil {
		t.Fatalf("failed to encrypt secrets: %v", err)
	}

	// 1. Attempt decryption with Machine B key (must fail AES-GCM authentication)
	decryptedCorrupted, err := crypto.Decrypt(ciphertext, keyMachineB)
	if err == nil {
		// If by improbable chance decryption didn't error, unmarshal MUST fail
		var dummy map[string]string
		if errUnmarshal := json.Unmarshal(decryptedCorrupted, &dummy); errUnmarshal == nil && dummy["gemini_api_key"] == secretsPayload["gemini_api_key"] {
			t.Fatalf("CRITICAL SECURITY RISK: Machine B key successfully decrypted Machine A payload!")
		}
	}

	// 2. Decrypt with correct Machine A key (must succeed)
	decryptedOriginal, err := crypto.Decrypt(ciphertext, keyMachineA)
	if err != nil {
		t.Fatalf("failed to decrypt with correct key: %v", err)
	}

	var restored map[string]string
	if err := json.Unmarshal(decryptedOriginal, &restored); err != nil {
		t.Fatalf("failed to unmarshal decrypted JSON: %v", err)
	}

	if restored["gemini_api_key"] != secretsPayload["gemini_api_key"] {
		t.Errorf("expected %q, got %q", secretsPayload["gemini_api_key"], restored["gemini_api_key"])
	}
}
