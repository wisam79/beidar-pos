package crypto_test

import (
	"strings"
	"testing"

	"beidar-desktop/pkg/crypto"
)

// TestDeriveKey checks that the same seed always produces the same 32-byte key.
func TestDeriveKey_Deterministic(t *testing.T) {
	key1 := crypto.DeriveKey("beidar-secret")
	key2 := crypto.DeriveKey("beidar-secret")

	if len(key1) != 32 {
		t.Errorf("DeriveKey length = %d, want 32", len(key1))
	}
	for i := range key1 {
		if key1[i] != key2[i] {
			t.Errorf("DeriveKey is not deterministic at byte %d", i)
		}
	}
}

// TestDeriveKey_DifferentSeeds checks that different seeds produce different keys.
func TestDeriveKey_DifferentSeeds(t *testing.T) {
	key1 := crypto.DeriveKey("seed-one")
	key2 := crypto.DeriveKey("seed-two")

	identical := true
	for i := range key1 {
		if key1[i] != key2[i] {
			identical = false
			break
		}
	}
	if identical {
		t.Error("Different seeds should produce different keys")
	}
}

// TestEncryptDecrypt verifies round-trip encryption/decryption.
func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	key := crypto.DeriveKey("test-encryption-key")
	plaintext := []byte("Hello, Beidar POS! مرحبا بيدر")

	ciphertext, err := crypto.Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}
	if ciphertext == "" {
		t.Fatal("Encrypt returned empty ciphertext")
	}

	decrypted, err := crypto.Decrypt(ciphertext, key)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}
	if string(decrypted) != string(plaintext) {
		t.Errorf("Round-trip failed: got %q, want %q", string(decrypted), string(plaintext))
	}
}

// TestEncrypt_DifferentNoncesEachTime verifies that two encryptions of the same
// plaintext produce different ciphertexts (nonce randomness).
func TestEncrypt_DifferentNoncesEachTime(t *testing.T) {
	key := crypto.DeriveKey("nonce-test-key")
	plaintext := []byte("same text every time")

	ct1, _ := crypto.Encrypt(plaintext, key)
	ct2, _ := crypto.Encrypt(plaintext, key)

	if ct1 == ct2 {
		t.Error("Two encryptions of the same plaintext must produce different ciphertexts (nonce must be random)")
	}
}

// TestDecrypt_WrongKey verifies that decryption with a wrong key fails.
func TestDecrypt_WrongKey(t *testing.T) {
	rightKey := crypto.DeriveKey("correct-key")
	wrongKey := crypto.DeriveKey("wrong-key")

	ct, err := crypto.Encrypt([]byte("secret data"), rightKey)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	_, err = crypto.Decrypt(ct, wrongKey)
	if err == nil {
		t.Error("Decrypt with wrong key should fail")
	}
}

// TestDecrypt_TamperedCiphertext verifies authentication failure on tampered data.
func TestDecrypt_TamperedCiphertext(t *testing.T) {
	key := crypto.DeriveKey("tamper-test-key")
	ct, _ := crypto.Encrypt([]byte("authentic data"), key)

	// Tamper: flip a character in the middle of the base64 string
	runes := []rune(ct)
	mid := len(runes) / 2
	if runes[mid] == 'A' {
		runes[mid] = 'B'
	} else {
		runes[mid] = 'A'
	}
	tampered := string(runes)

	_, err := crypto.Decrypt(tampered, key)
	if err == nil {
		t.Error("Decrypt should fail for tampered ciphertext")
	}
}

// TestDecrypt_InvalidBase64 verifies graceful handling of non-base64 input.
func TestDecrypt_InvalidBase64(t *testing.T) {
	key := crypto.DeriveKey("any-key")
	_, err := crypto.Decrypt("NOT_VALID_BASE64!!!", key)
	if err == nil {
		t.Error("Decrypt should fail for invalid base64 input")
	}
}

// TestDecrypt_TooShortCiphertext verifies that a too-short payload is rejected.
func TestDecrypt_TooShortCiphertext(t *testing.T) {
	key := crypto.DeriveKey("short-test-key")
	// Provide a valid base64 of only 1 byte — shorter than any nonce
	_, err := crypto.Decrypt("AA==", key)
	if err == nil {
		t.Error("Decrypt should fail for ciphertext shorter than nonce size")
	}
}

// TestEncryptDecrypt_EmptyPlaintext checks that empty plaintext can be handled.
func TestEncryptDecrypt_EmptyPlaintext(t *testing.T) {
	key := crypto.DeriveKey("empty-plaintext-key")
	ct, err := crypto.Encrypt([]byte(""), key)
	if err != nil {
		t.Fatalf("Encrypt of empty plaintext failed: %v", err)
	}

	decrypted, err := crypto.Decrypt(ct, key)
	if err != nil {
		t.Fatalf("Decrypt of empty plaintext failed: %v", err)
	}
	if strings.TrimSpace(string(decrypted)) != "" {
		t.Errorf("Expected empty decrypted result, got %q", string(decrypted))
	}
}
