package integration

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"

	"beidar-desktop/internal/core/domain"
)

var (
	zohoConfig     *domain.ZohoConfig
	zohoConfigLock sync.RWMutex
	syncQueue      []domain.ZohoSyncQueue
	syncQueueLock  sync.Mutex
)

func getZohoConfigPath() string {
	configDir, _ := os.UserConfigDir()
	return filepath.Join(configDir, "BeidarPOS_V3", "zoho_config.json")
}

func (s *cloudService) LoadZohoConfig() (*domain.ZohoConfig, error) {
	zohoConfigLock.Lock()
	defer zohoConfigLock.Unlock()

	if zohoConfig != nil {
		return zohoConfig, nil
	}

	path := getZohoConfigPath()
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var config domain.ZohoConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	zohoConfig = &config
	return zohoConfig, nil
}

func (s *cloudService) SaveZohoConfig(config *domain.ZohoConfig) error {
	zohoConfigLock.Lock()
	defer zohoConfigLock.Unlock()

	path := getZohoConfigPath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	zohoConfig = config
	return os.WriteFile(path, data, 0600)
}

func (s *cloudService) IsZohoEnabled() bool {
	config, err := s.LoadZohoConfig()
	if err != nil {
		return false
	}
	return config.Enabled && config.RefreshToken != ""
}

func (s *cloudService) ExchangeCodeForToken(clientID, clientSecret, code string) (*domain.ZohoTokenResponse, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)

	resp, err := http.PostForm("https://accounts.zoho.com/oauth/v2/token", data)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var tokenResp domain.ZohoTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}

	if tokenResp.Error != "" {
		return nil, errors.New(tokenResp.Error)
	}

	return &tokenResp, nil
}

func (s *cloudService) RefreshAccessToken() error {
	config, err := s.LoadZohoConfig()
	if err != nil {
		return err
	}

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("client_id", config.ClientID)
	data.Set("client_secret", config.ClientSecret)
	data.Set("refresh_token", config.RefreshToken)

	resp, err := http.PostForm("https://accounts.zoho.com/oauth/v2/token", data)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var tokenResp domain.ZohoTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return err
	}

	if tokenResp.Error != "" {
		return errors.New(tokenResp.Error)
	}

	config.AccessToken = tokenResp.AccessToken
	config.TokenExpiry = time.Now().Unix() + tokenResp.ExpiresIn
	return s.SaveZohoConfig(config)
}

func (s *cloudService) GetValidAccessToken() (string, error) {
	config, err := s.LoadZohoConfig()
	if err != nil {
		return "", err
	}

	if time.Now().Unix() >= config.TokenExpiry-300 {
		if err := s.RefreshAccessToken(); err != nil {
			return "", err
		}
		config, _ = s.LoadZohoConfig()
	}

	return config.AccessToken, nil
}

func (s *cloudService) GetOrganizationID() (string, error) {
	token, err := s.GetValidAccessToken()
	if err != nil {
		return "", err
	}

	req, _ := http.NewRequest("GET", "https://www.zohoapis.com/books/v3/organizations", nil)
	req.Header.Set("Authorization", "Zoho-oauthtoken "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Organizations []struct {
			OrganizationID string `json:"organization_id"`
			Name           string `json:"name"`
			IsPrimary      bool   `json:"is_primary"`
		} `json:"organizations"`
	}

	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	if len(result.Organizations) == 0 {
		return "", errors.New("no organizations found")
	}

	for _, org := range result.Organizations {
		if org.IsPrimary {
			return org.OrganizationID, nil
		}
	}
	return result.Organizations[0].OrganizationID, nil
}

func (s *cloudService) CreateZohoInvoice(sale *domain.Sale) error {
	if !s.IsZohoEnabled() {
		return nil
	}

	config, err := s.LoadZohoConfig()
	if err != nil {
		return err
	}

	token, err := s.GetValidAccessToken()
	if err != nil {
		s.AddToSyncQueue(sale.ID)
		return err
	}

	invoice := domain.ZohoInvoice{
		CustomerName:    sale.CustomerName,
		Date:            sale.Date,
		Notes:           fmt.Sprintf("Beidar POS - Sale #%s", sale.ID),
		ReferenceNumber: sale.ID,
		LineItems:       make([]domain.ZohoLineItem, 0),
	}

	for _, item := range sale.Items {
		invoice.LineItems = append(invoice.LineItems, domain.ZohoLineItem{
			Name:     item.Name,
			Rate:     item.Price.Float(),
			Quantity: item.Quantity,
		})
	}

	payload, _ := json.Marshal(map[string]interface{}{"invoice": invoice})

	url := fmt.Sprintf("https://www.zohoapis.com/books/v3/invoices?organization_id=%s", config.OrganizationID)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Zoho-oauthtoken "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		s.AddToSyncQueue(sale.ID)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		body, _ := io.ReadAll(resp.Body)
		s.AddToSyncQueue(sale.ID)
		return fmt.Errorf("zoho API error: %s", string(body))
	}

	// Update synced status in repo
	_ = s.saleRepo.MarkSaleAsSynced(sale.ID)
	return nil
}

func (s *cloudService) AddToSyncQueue(saleID string) {
	syncQueueLock.Lock()
	defer syncQueueLock.Unlock()

	for _, item := range syncQueue {
		if item.SaleID == saleID {
			return
		}
	}

	syncQueue = append(syncQueue, domain.ZohoSyncQueue{
		SaleID:    saleID,
		CreatedAt: time.Now().Format(time.RFC3339),
		Retries:   0,
	})
}

func (s *cloudService) ProcessSyncQueue() {
	if !s.IsZohoEnabled() {
		return
	}

	// Populated from DB to prevent memory loss on restart
	unsyncedSales, err := s.saleRepo.GetUnsyncedSales()
	if err != nil {
		return
	}

	for _, sale := range unsyncedSales {
		_ = s.CreateZohoInvoice(&sale)
	}
}

func (s *cloudService) StartZohoSyncWorker() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			s.ProcessSyncQueue()
		}
	}()
}

func (s *cloudService) SetupZohoIntegration(clientID, clientSecret, authCode string) error {
	tokenResp, err := s.ExchangeCodeForToken(clientID, clientSecret, authCode)
	if err != nil {
		return fmt.Errorf("failed to exchange code: %v", err)
	}

	config := &domain.ZohoConfig{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RefreshToken: tokenResp.RefreshToken,
		AccessToken:  tokenResp.AccessToken,
		TokenExpiry:  time.Now().Unix() + tokenResp.ExpiresIn,
		Enabled:      true,
	}

	if err := s.SaveZohoConfig(config); err != nil {
		return err
	}

	orgID, err := s.GetOrganizationID()
	if err != nil {
		return fmt.Errorf("failed to get organization: %v", err)
	}

	config.OrganizationID = orgID
	if err := s.SaveZohoConfig(config); err != nil {
		return err
	}

	s.ProcessSyncQueue()
	return nil
}

func (s *cloudService) DisableZohoIntegration() error {
	config, err := s.LoadZohoConfig()
	if err != nil {
		return err
	}
	config.Enabled = false
	return s.SaveZohoConfig(config)
}

func (s *cloudService) GetZohoStatus() map[string]interface{} {
	config, err := s.LoadZohoConfig()
	if err != nil {
		return map[string]interface{}{
			"enabled":    false,
			"configured": false,
		}
	}

	// Calculate queue length from DB
	queueLength := 0
	unsyncedSales, err := s.saleRepo.GetUnsyncedSales()
	if err == nil {
		queueLength = len(unsyncedSales)
	}

	return map[string]interface{}{
		"enabled":        config.Enabled,
		"configured":     config.RefreshToken != "",
		"organizationId": config.OrganizationID,
		"queueLength":    queueLength,
	}
}
