package network

import (
	"beidar-desktop/internal/core/domain"
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type LanConfig struct {
	ServerAddress     string `json:"serverAddress"`
	SessionToken      string `json:"sessionToken"`
	ServerFingerprint string `json:"serverFingerprint,omitempty"`
}

func getLanConfigPath() string {
	configDir, _ := os.UserConfigDir()
	return filepath.Join(configDir, "BeidarPOS_V3", "lan_config.json")
}

func createSecureHTTPClient(expectedFingerprint *string) *http.Client {
	tlsConfig := &tls.Config{
		MinVersion:         tls.VersionTLS13,
		InsecureSkipVerify: true, // Certificate fingerprint is manually verified in VerifyPeerCertificate below
		VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
			if len(rawCerts) == 0 {
				return fmt.Errorf("no certificate presented by server")
			}
			peerFingerprint := CalculateCertFingerprint(rawCerts[0])
			if expectedFingerprint != nil && *expectedFingerprint != "" {
				if !strings.EqualFold(peerFingerprint, *expectedFingerprint) {
					return fmt.Errorf("بصمة شهادة الخادم غير مطابقة! (المتوقع: %s, المستلم: %s)", *expectedFingerprint, peerFingerprint)
				}
			} else if expectedFingerprint != nil {
				// Capture fingerprint on first pairing
				*expectedFingerprint = peerFingerprint
			}
			return nil
		},
	}

	transport := &http.Transport{
		TLSClientConfig:       tlsConfig,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		IdleConnTimeout:       60 * time.Second,
	}

	return &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
	}
}

func (s *lanService) saveLanConfig() error {
	s.clientMutex.RLock()
	config := LanConfig{
		ServerAddress:     s.serverAddress,
		SessionToken:      s.sessionToken,
		ServerFingerprint: s.serverFingerprintClient,
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

func (s *lanService) loadSavedLanConfig() {
	configPath := getLanConfigPath()
	data, err := os.ReadFile(configPath)
	if err != nil {
		return
	}
	var config LanConfig
	if err := json.Unmarshal(data, &config); err == nil && config.ServerAddress != "" && config.SessionToken != "" {
		s.clientMutex.Lock()
		s.serverAddress = config.ServerAddress
		s.sessionToken = config.SessionToken
		s.serverFingerprintClient = config.ServerFingerprint
		s.clientMode = true
		fp := config.ServerFingerprint
		s.httpClient = createSecureHTTPClient(&fp)
		s.clientMutex.Unlock()
	}
}

func (s *lanService) ConnectToServer(serverIP string, port int, secret string) error {
	s.clientMutex.Lock()
	defer s.clientMutex.Unlock()

	if port == 0 {
		port = DefaultLanPort
	}

	// Try HTTPS first (Default & Standard)
	var capturedFingerprint string
	httpsClient := createSecureHTTPClient(&capturedFingerprint)
	httpsAddress := fmt.Sprintf("https://%s:%d", serverIP, port)

	resp, err := httpsClient.Get(httpsAddress + "/api/ping")
	var address string
	var client *http.Client

	if err == nil && resp.StatusCode == http.StatusOK {
		resp.Body.Close()
		address = httpsAddress
		client = httpsClient
	} else {
		if resp != nil {
			resp.Body.Close()
		}
		// Fallback to plain HTTP if HTTPS connection fails (e.g. testing with mock server)
		httpAddress := fmt.Sprintf("http://%s:%d", serverIP, port)
		plainClient := &http.Client{Timeout: 10 * time.Second}
		respHttp, errHttp := plainClient.Get(httpAddress + "/api/ping")
		if errHttp != nil {
			return fmt.Errorf("فشل الاتصال بالخادم عبر HTTPS أو HTTP: %v", err)
		}
		respHttp.Body.Close()
		if respHttp.StatusCode != http.StatusOK {
			return fmt.Errorf("الخادم غير متاح (كود: %d)", respHttp.StatusCode)
		}
		address = httpAddress
		client = plainClient
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

	resp, err = client.Post(address+"/api/connect", "application/json", bytes.NewBuffer(jsonData))
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
	s.serverFingerprintClient = capturedFingerprint
	s.httpClient = client
	s.clientMode = true

	go func() {
		_ = s.saveLanConfig()
	}()

	fmt.Printf("✅ Connected to LAN server at %s (Fingerprint: %s)\n", address, capturedFingerprint)
	return nil
}

func (s *lanService) DisconnectFromServer() {
	s.clientMutex.Lock()
	defer s.clientMutex.Unlock()

	s.clientMode = false
	s.serverAddress = ""
	s.sessionToken = ""
	s.serverFingerprintClient = ""

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

	useTLS := strings.HasPrefix(s.serverAddress, "https://")

	return domain.LanClientStatus{
		Connected:     s.clientMode,
		ServerAddress: s.serverAddress,
		Mode:          mode,
		UseTLS:        useTLS,
		Fingerprint:   s.serverFingerprintClient,
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
