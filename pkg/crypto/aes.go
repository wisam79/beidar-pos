package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"

	"golang.org/x/crypto/pbkdf2"
)

// DeriveKey creates a 32-byte AES-256 key from a seed string using PBKDF2.
func DeriveKey(seed string) []byte {
	// Use a static salt derived from the seed for deterministic keys, or a fixed salt.
	// For backward compatibility in logic, we derive a static salt from the seed itself or use a constant.
	// A constant salt for PBKDF2 when deterministic keys are needed (e.g. searching).
	salt := []byte("beidar_pos_salt_v2")
	return pbkdf2.Key([]byte(seed), salt, 100000, 32, sha256.New)
}

// Encrypt encrypts plaintext using AES-256-GCM. Returns base64( nonce + ciphertext ).
func Encrypt(plaintext []byte, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := aesGCM.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts base64( nonce + ciphertext ) using AES-256-GCM.
func Decrypt(encoded string, key []byte) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := aesGCM.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	return aesGCM.Open(nil, nonce, ciphertext, nil)
}
