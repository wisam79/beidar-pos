package network

import (
	"beidar-desktop/internal/core/domain"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"time"
)

// GenerateSessionToken creates a unique session token for a client
func (s *lanService) GenerateSessionToken() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate secure session token: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// RegisterClient registers a new client connection
func (s *lanService) RegisterClient(deviceID, deviceName, ipAddress string) (string, error) {
	// Check if device is blocked
	blocked, err := s.networkRepo.IsDeviceBlocked(deviceID)
	if err != nil {
		return "", err
	}
	if blocked {
		return "", fmt.Errorf("هذا الجهاز محظور من الاتصال")
	}

	s.clientsMutex.Lock()
	defer s.clientsMutex.Unlock()

	token, err := s.GenerateSessionToken()
	if err != nil {
		return "", err
	}
	now := time.Now().Unix()

	s.connectedClients[deviceID] = &domain.ConnectedClient{
		DeviceID:     deviceID,
		DeviceName:   deviceName,
		IPAddress:    ipAddress,
		ConnectedAt:  now,
		LastActivity: now,
		Status:       "active",
		SessionToken: token,
		Role:         "cashier", // Default role for LAN clients is cashier (restricted)
	}

	fmt.Printf("✅ Client registered: %s (%s) from %s\n", deviceName, deviceID, ipAddress)
	return token, nil
}

// ValidateSessionToken checks if a session token is valid and returns the client
func (s *lanService) ValidateSessionToken(token string) (*domain.ConnectedClient, error) {
	s.clientsMutex.RLock()
	defer s.clientsMutex.RUnlock()

	for _, client := range s.connectedClients {
		if client.SessionToken == token {
			if client.Status == "suspended" {
				return nil, fmt.Errorf("جلستك معلّقة من قبل المدير")
			}
			return client, nil
		}
	}
	return nil, fmt.Errorf("جلسة غير صالحة")
}

// UpdateClientActivity updates the last activity timestamp
func (s *lanService) UpdateClientActivity(token string) {
	s.clientsMutex.Lock()
	defer s.clientsMutex.Unlock()

	for _, client := range s.connectedClients {
		if client.SessionToken == token {
			client.LastActivity = time.Now().Unix()
			return
		}
	}
}

// GetConnectedClients returns all connected clients (stripping tokens)
func (s *lanService) GetConnectedClients() []domain.ConnectedClient {
	s.clientsMutex.RLock()
	defer s.clientsMutex.RUnlock()

	clients := make([]domain.ConnectedClient, 0, len(s.connectedClients))
	for _, c := range s.connectedClients {
		client := *c
		client.SessionToken = "" // Strip token for safety
		clients = append(clients, client)
	}
	return clients
}

// DisconnectClient removes a client from connected list
func (s *lanService) DisconnectClient(deviceID string) error {
	s.clientsMutex.Lock()
	defer s.clientsMutex.Unlock()

	if _, exists := s.connectedClients[deviceID]; !exists {
		return fmt.Errorf("الجهاز غير متصل")
	}

	delete(s.connectedClients, deviceID)
	fmt.Printf("🔌 Client disconnected: %s\n", deviceID)
	return nil
}

// SuspendClient temporarily suspends a client
func (s *lanService) SuspendClient(deviceID string) error {
	s.clientsMutex.Lock()
	defer s.clientsMutex.Unlock()

	client, exists := s.connectedClients[deviceID]
	if !exists {
		return fmt.Errorf("الجهاز غير متصل")
	}

	client.Status = "suspended"
	fmt.Printf("⏸️ Client suspended: %s\n", deviceID)
	return nil
}

// ResumeClient resumes a suspended client
func (s *lanService) ResumeClient(deviceID string) error {
	s.clientsMutex.Lock()
	defer s.clientsMutex.Unlock()

	client, exists := s.connectedClients[deviceID]
	if !exists {
		return fmt.Errorf("الجهاز غير متصل")
	}

	client.Status = "active"
	fmt.Printf("▶️ Client resumed: %s\n", deviceID)
	return nil
}

// BlockDevice permanently blocks a device and disconnects it
func (s *lanService) BlockDevice(deviceID, deviceName, reason string) error {
	// First disconnect if connected
	_ = s.DisconnectClient(deviceID)

	blocked := domain.BlockedDevice{
		DeviceID:   deviceID,
		DeviceName: deviceName,
		BlockedAt:  time.Now().Unix(),
		Reason:     reason,
	}

	return s.networkRepo.BlockDevice(&blocked)
}

// UnblockDevice removes a device from blocked list
func (s *lanService) UnblockDevice(id uint) error {
	return s.networkRepo.UnblockDevice(id)
}

// GetBlockedDevices returns all blocked devices
func (s *lanService) GetBlockedDevices() ([]domain.BlockedDevice, error) {
	return s.networkRepo.GetBlockedDevices()
}

// CleanupInactiveClients removes clients inactive for too long
func (s *lanService) CleanupInactiveClients(maxInactiveSeconds int64) {
	s.clientsMutex.Lock()
	defer s.clientsMutex.Unlock()

	now := time.Now().Unix()
	for deviceID, client := range s.connectedClients {
		if now-client.LastActivity > maxInactiveSeconds {
			delete(s.connectedClients, deviceID)
			fmt.Printf("🧹 Cleaned up inactive client: %s\n", deviceID)
		}
	}
}

// ClearAllClients removes all connected clients
func (s *lanService) ClearAllClients() {
	s.clientsMutex.Lock()
	s.connectedClients = make(map[string]*domain.ConnectedClient)
	s.clientsMutex.Unlock()
}

// GenerateServerSecret creates a new random secret for the LAN server.
// Uses 16 bytes (128 bits) of entropy, rendered as 32 hex characters.
func (s *lanService) GenerateServerSecret() (string, error) {
	s.secretMutex.Lock()
	defer s.secretMutex.Unlock()

	bytes := make([]byte, 16) // 128-bit secret → 32 hex characters
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate secure server secret: %w", err)
	}
	s.secret = hex.EncodeToString(bytes)
	return s.secret, nil
}

// GetServerSecret returns the current server secret
func (s *lanService) GetServerSecret() string {
	s.secretMutex.RLock()
	defer s.secretMutex.RUnlock()
	return s.secret
}

// ValidateServerSecret checks if the provided secret matches using a
// constant-time comparison to resist timing attacks.
func (s *lanService) ValidateServerSecret(secret string) bool {
	s.secretMutex.RLock()
	defer s.secretMutex.RUnlock()
	if s.secret == "" || secret == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(secret), []byte(s.secret)) == 1
}
