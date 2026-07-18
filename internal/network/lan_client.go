package network

import (
	"beidar-desktop/internal/core/domain"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

type LanConfig struct {
	ServerAddress string `json:"serverAddress"`
	SessionToken  string `json:"sessionToken"`
}

func getLanConfigPath() string {
	configDir, _ := os.UserConfigDir()
	return filepath.Join(configDir, "BeidarPOS_V3", "lan_config.json")
}

func (s *lanService) saveLanConfig() error {
	s.clientMutex.RLock()
	config := LanConfig{
		ServerAddress: s.serverAddress,
		SessionToken:  s.sessionToken,
	}
	s.clientMutex.RUnlock()

	if config.ServerAddress == "" {
		_ = os.Remove(getLanConfigPath())
		return nil
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	configPath := getLanConfigPath()
	_ = os.MkdirAll(filepath.Dir(configPath), 0755)
	return os.WriteFile(configPath, data, 0600)
}

func (s *lanService) ConnectToServer(serverIP string, port int, secret string) error {
	s.clientMutex.Lock()
	defer s.clientMutex.Unlock()

	if port == 0 {
		port = DefaultLanPort
	}

	address := fmt.Sprintf("http://%s:%d", serverIP, port)

	resp, err := s.httpClient.Get(address + "/api/ping")
	if err != nil {
		return fmt.Errorf("فشل الاتصال: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("الخادم غير متاح (كود: %d)", resp.StatusCode)
	}

	deviceID, _ := s.settingsService.GetDeviceID()
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "Beidar Client"
	}

	connectReq := map[string]string{
		"deviceId":   deviceID,
		"deviceName": hostname,
		"secret":     secret,
	}
	jsonData, _ := json.Marshal(connectReq)

	resp, err = s.httpClient.Post(address+"/api/connect", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("فشل التسجيل: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		var errResp map[string]string
		if json.Unmarshal(body, &errResp) == nil && errResp["error"] != "" {
			return fmt.Errorf("%s", errResp["error"])
		}
		return fmt.Errorf("فشل التسجيل (كود: %d)", resp.StatusCode)
	}

	var connectResp map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&connectResp); err != nil {
		return fmt.Errorf("استجابة غير صالحة")
	}

	token := connectResp["token"]
	if token == "" {
		return fmt.Errorf("لم يتم الحصول على توكن الجلسة")
	}

	s.serverAddress = address
	s.sessionToken = token
	s.clientMode = true

	go func() {
		_ = s.saveLanConfig()
	}()

	fmt.Printf("✅ Connected to LAN server at %s\n", address)
	return nil
}

func (s *lanService) DisconnectFromServer() {
	s.clientMutex.Lock()
	defer s.clientMutex.Unlock()

	s.clientMode = false
	s.serverAddress = ""
	s.sessionToken = ""

	go func() {
		_ = s.saveLanConfig()
	}()

	fmt.Println("🔌 Disconnected from LAN server")
}

func (s *lanService) IsClientMode() bool {
	s.clientMutex.RLock()
	defer s.clientMutex.RUnlock()
	return s.clientMode
}

func (s *lanService) GetClientStatus() domain.LanClientStatus {
	s.clientMutex.RLock()
	defer s.clientMutex.RUnlock()

	mode := "standalone"
	if s.clientMode {
		mode = "client"
	} else if s.IsServerRunning() {
		mode = "server"
	}

	return domain.LanClientStatus{
		Connected:     s.clientMode,
		ServerAddress: s.serverAddress,
		Mode:          mode,
	}
}

func (s *lanService) TestConnection() string {
	s.clientMutex.RLock()
	address := s.serverAddress
	token := s.sessionToken
	s.clientMutex.RUnlock()

	if address == "" || token == "" {
		return "Not connected (Address or Token empty)"
	}

	req, err := http.NewRequest("GET", address+"/api/products", nil)
	if err != nil {
		return fmt.Sprintf("Request Error: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Sprintf("Network Error: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if len(body) > 500 {
		return fmt.Sprintf("Success (Status %d)! Data preview: %s...", resp.StatusCode, string(body[:500]))
	}
	return fmt.Sprintf("Complete Response (Status %d): %s", resp.StatusCode, string(body))
}

// REST Client Helper Methods

func (s *lanService) RemoteGet(endpoint string, result interface{}) error {
	s.clientMutex.RLock()
	address := s.serverAddress
	token := s.sessionToken
	s.clientMutex.RUnlock()

	if address == "" || token == "" {
		return fmt.Errorf("غير متصل بالسيرفر")
	}

	req, err := http.NewRequest("GET", address+endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("جلسة غير صالحة - أعد الاتصال")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server error: %s", string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	return json.Unmarshal(body, result)
}

func (s *lanService) RemotePost(endpoint string, data interface{}, result interface{}) error {
	s.clientMutex.RLock()
	address := s.serverAddress
	token := s.sessionToken
	s.clientMutex.RUnlock()

	if address == "" || token == "" {
		return fmt.Errorf("غير متصل بالسيرفر")
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", address+endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("جلسة غير صالحة - أعد الاتصال")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server error: %s", string(body))
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

func (s *lanService) RemoteDelete(endpoint string) error {
	s.clientMutex.RLock()
	address := s.serverAddress
	token := s.sessionToken
	s.clientMutex.RUnlock()

	if address == "" || token == "" {
		return fmt.Errorf("غير متصل بالسيرفر")
	}

	req, err := http.NewRequest("DELETE", address+endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("جلسة غير صالحة - أعد الاتصال")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server error: %s", string(body))
	}

	return nil
}
