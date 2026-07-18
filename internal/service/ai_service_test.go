package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/secureconfig"
)

// mockSettingsService for AI tests
type mockSettingsService struct {
	domain.SettingsService
	prefs       *domain.AppPreferences
	prefsErr    error
	geminiKeys  []string
	groqKeys    []string
}

func (m *mockSettingsService) GetPreferences() (*domain.AppPreferences, error) {
	return m.prefs, m.prefsErr
}

func (m *mockSettingsService) FetchGlobalAIKeys() ([]string, error) {
	return m.geminiKeys, nil
}

func (m *mockSettingsService) FetchGlobalGroqKeys() ([]string, error) {
	return m.groqKeys, nil
}

func TestSelectWeightedModel(t *testing.T) {
	aiSvc := &aiService{}

	models := []WeightedModel{
		{"A", 10},
		{"B", 5},
	}

	modelA := aiSvc.selectWeightedModel(models)
	if modelA != "A" && modelA != "B" {
		t.Errorf("Expected A or B, got %v", modelA)
	}

	// Test empty models
	empty := aiSvc.selectWeightedModel([]WeightedModel{})
	if empty != "" {
		t.Errorf("Expected empty string for empty models, got %v", empty)
	}
}

func TestSelectGeminiKey(t *testing.T) {
	aiSvc := &aiService{}
	prefs := &domain.AppPreferences{
		GeminiAPIKey: "key1",
		GeminiAPIKeys: []string{"key2", "key3"},
	}

	// Test priority from prefs
	key := aiSvc.selectGeminiKey(prefs)
	if key != "key1" && key != "key2" && key != "key3" {
		t.Errorf("Expected one of key1, key2, key3, got %v", key)
	}

	// Test fallback to settings service
	mockSettings := &mockSettingsService{
		geminiKeys: []string{"global-gemini"},
	}
	aiSvcWithSettings := &aiService{settingsService: mockSettings}
	emptyPrefs := &domain.AppPreferences{}
	globalKey := aiSvcWithSettings.selectGeminiKey(emptyPrefs)
	if globalKey != "global-gemini" {
		t.Errorf("Expected global-gemini, got %v", globalKey)
	}
}

func TestSelectGroqKey(t *testing.T) {
	aiSvc := &aiService{}
	prefs := &domain.AppPreferences{
		GroqAPIKey: "groq-key1",
	}

	key := aiSvc.selectGroqKey(prefs)
	if key != "groq-key1" {
		t.Errorf("Expected groq-key1, got %v", key)
	}

	// Test fallback to settings service
	mockSettings := &mockSettingsService{
		groqKeys: []string{"global-groq"},
	}
	aiSvcWithSettings := &aiService{settingsService: mockSettings}
	emptyPrefs := &domain.AppPreferences{}
	globalKey := aiSvcWithSettings.selectGroqKey(emptyPrefs)
	if globalKey != "global-groq" {
		t.Errorf("Expected global-groq, got %v", globalKey)
	}
}

func TestCancelStream(t *testing.T) {
	aiSvc := NewAIService(&mockSettingsService{})
	
	// Ensure no panic when no context exists
	aiSvc.CancelStream()

	ctx, cancel := context.WithCancel(context.Background())
	svc := aiSvc.(*aiService)
	svc.aiCancel = cancel
	
	svc.CancelStream()
	
	if ctx.Err() == nil {
		t.Errorf("Expected context to be canceled")
	}
}

func TestGenerateStream(t *testing.T) {
	mockSettings := &mockSettingsService{
		prefs: &domain.AppPreferences{
			AIProvider: "gemini",
			AIRotationMode: "disabled",
		},
	}
	aiSvc := NewAIService(mockSettings)

	// Test successful case with missing API key (should immediately error out internally and call onError)
	os.Setenv("BEIDAR_SUPABASE_URL", "http://localhost:1")
	defer os.Unsetenv("BEIDAR_SUPABASE_URL")

	// Temporary hide local secrets file to avoid picking up developer's real API keys
	cd, _ := os.UserConfigDir()
	realConfigPath := filepath.Join(cd, "BeidarPOS_V3", "secrets.enc")
	backupPath := realConfigPath + ".testbackup"
	if _, err := os.Stat(realConfigPath); err == nil {
		_ = os.Rename(realConfigPath, backupPath)
		defer os.Rename(backupPath, realConfigPath)
	}

	// Unset environment keys that might override empty config
	oldGeminiKey := os.Getenv("GEMINI_API_KEY")
	if oldGeminiKey != "" {
		os.Unsetenv("GEMINI_API_KEY")
		defer os.Setenv("GEMINI_API_KEY", oldGeminiKey)
	}
	oldGrokKey := os.Getenv("grok")
	if oldGrokKey != "" {
		os.Unsetenv("grok")
		defer os.Setenv("grok", oldGrokKey)
	}

	secureconfig.ResetCache()
	defer secureconfig.ResetCache()

	errChan := make(chan string, 1)
	err := aiSvc.GenerateStream("hello", 
		func(c string) {}, 
		func(e string) { errChan <- e }, 
		func() {})
	
	if err != nil {
		t.Errorf("Expected GenerateStream to return nil synchronously, got %v", err)
	}

	select {
	case e := <-errChan:
		if e == "" {
			t.Errorf("Expected an error message from onError callback")
		}
	case <-time.After(1 * time.Second):
		t.Errorf("Timeout waiting for onError callback")
	}

	// Test concurrent request locking
	err = aiSvc.GenerateStream("hello", func(string){}, func(string){}, func(){})
	if err == nil {
		// Because the first stream error unlocked the mutex, this should pass. Let's explicitly lock it to simulate running task.
		svc := aiSvc.(*aiService)
		svc.aiMutex.Lock()
		err2 := aiSvc.GenerateStream("hello", func(string){}, func(string){}, func(){})
		if err2 == nil {
			t.Errorf("Expected error when AI is busy")
		}
		svc.aiMutex.Unlock()
	}

	// Test error loading preferences
	mockSettingsErr := &mockSettingsService{
		prefsErr: errors.New("db error"),
	}
	aiSvcErr := NewAIService(mockSettingsErr)
	err = aiSvcErr.GenerateStream("hello", func(string){}, func(string){}, func(){})
	if err == nil {
		t.Errorf("Expected error when failing to load preferences")
	}
}
