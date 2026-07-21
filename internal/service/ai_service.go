package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/secureconfig"
)

type WeightedModel struct {
	Name   string
	Weight int
}

var groqWeightedModels = []WeightedModel{
	{"llama-3.1-8b-instant", 14},
	{"allam-2-7b", 7},
	{"llama-3.3-70b-versatile", 1},
	{"qwen/qwen3.6-27b", 1},
}

var geminiWeightedModels = []WeightedModel{
	{"gemma-4-31b-it", 1},
}

type aiService struct {
	settingsService domain.SettingsService
	aiMutex         sync.Mutex
	aiCancelMu      sync.Mutex
	aiCancel        context.CancelFunc
	requestCounter  uint64
}

// NewAIService creates a new instance of domain.AIService
func NewAIService(settingsService domain.SettingsService) domain.AIService {
	return &aiService{
		settingsService: settingsService,
	}
}

func (s *aiService) GenerateStream(prompt string, onChunk func(string), onError func(string), onComplete func()) error {
	if !s.aiMutex.TryLock() {
		return fmt.Errorf("يوجد طلب ذكاء اصطناعي قيد التنفيذ بالفعل، انتظر حتى يكتمل")
	}

	prefs, err := s.settingsService.GetPreferences()
	if err != nil {
		s.aiMutex.Unlock()
		return fmt.Errorf("failed to load preferences: %w", err)
	}

	// 1. Determine Provider
	provider := prefs.AIProvider
	if provider == "" {
		provider = "gemini"
	}

	// 2. Select starting model and build failover list
	var selectedModel string
	var fallbackModels []string

	if provider == "groq" {
		selectedModel = prefs.AIModel
		if selectedModel == "" {
			selectedModel = "llama-3.3-70b-versatile"
		}

		if prefs.AIRotationMode == "weighted" {
			selectedModel = s.selectWeightedModel(groqWeightedModels)
		}

		// Build fallback chain: selected model first, then others
		fallbackModels = append(fallbackModels, selectedModel)
		for _, m := range groqWeightedModels {
			if m.Name != selectedModel {
				fallbackModels = append(fallbackModels, m.Name)
			}
		}
	} else { // gemini
		selectedModel = prefs.AIModel
		if selectedModel == "" {
			selectedModel = "gemma-4-31b-it"
		}

		if prefs.AIRotationMode == "weighted" {
			selectedModel = s.selectWeightedModel(geminiWeightedModels)
		}

		// Build fallback chain
		fallbackModels = append(fallbackModels, selectedModel)
		for _, m := range geminiWeightedModels {
			if m.Name != selectedModel {
				fallbackModels = append(fallbackModels, m.Name)
			}
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.aiCancelMu.Lock()
	s.aiCancel = cancel
	s.aiCancelMu.Unlock()

	go func() {
		defer func() {
			s.aiMutex.Unlock()
			if r := recover(); r != nil {
				onError(fmt.Sprintf("Panic in AI orchestrator: %v", r))
			}
		}()

		// Try candidates sequentially (Failover Loop)
		var lastErr error
		for _, model := range fallbackModels {
			select {
			case <-ctx.Done():
				onComplete()
				return
			default:
			}

			// Get API Key and provider instance
			var apiKey string
			var providerInstance interface {
				GenerateStream(ctx context.Context, prompt string, apiKey string, model string, onChunk func(string), onError func(string)) error
			}

			if provider == "groq" {
				apiKey = s.selectGroqKey(prefs)
				providerInstance = &groqProvider{}
			} else { // gemini
				apiKey = s.selectGeminiKey(prefs)
				providerInstance = &geminiProvider{}
			}

			if apiKey == "" || apiKey == "********" {
				lastErr = fmt.Errorf("مفتاح الـ API الخاص بـ %s غير متوفر أو غير مضبوط بشكل صحيح", provider)
				if prefs.AIRotationMode == "disabled" {
					break
				}
				continue // try next candidate (if it has other configs/fallback) or fail
			}

			// Invoke the modular provider with Exponential Backoff
			var err error
			maxRetries := 3
			for attempt := 1; attempt <= maxRetries; attempt++ {
				err = providerInstance.GenerateStream(ctx, prompt, apiKey, model, onChunk, onError)
				if err == nil {
					// Success! Exit orchestrator
					onComplete()
					return
				}

				// If context was canceled by user, do not fallback, just exit
				if errors.Is(err, context.Canceled) {
					onComplete()
					return
				}

				// Exponential backoff
				if attempt < maxRetries {
					time.Sleep(time.Duration(attempt*attempt) * time.Second)
				}
			}

			// Log error and attempt next model in failover loop
			lastErr = err
			if prefs.AIRotationMode == "disabled" {
				break // failover is disabled
			}
		}

		// If we reached here, all attempts failed
		if lastErr != nil {
			onError(fmt.Sprintf("فشلت جميع المحاولات للاتصال بموفر الخدمة. الخطأ الأخير: %v", lastErr))
		} else {
			onError("فشل غير معروف في الاتصال بخدمة الذكاء الاصطناعي")
		}
	}()

	return nil
}

func (s *aiService) CancelStream() {
	s.aiCancelMu.Lock()
	defer s.aiCancelMu.Unlock()
	if s.aiCancel != nil {
		s.aiCancel()
		s.aiCancel = nil
	}
}

// selectWeightedModel chooses a model from models slice based on weights
func (s *aiService) selectWeightedModel(models []WeightedModel) string {
	totalWeight := 0
	for _, m := range models {
		totalWeight += m.Weight
	}

	if totalWeight <= 0 {
		if len(models) > 0 {
			return models[0].Name
		}
		return ""
	}

	// Use requestCounter for predictable weighted round-robin distribution
	count := atomic.AddUint64(&s.requestCounter, 1)
	val := int(count % uint64(totalWeight))

	current := 0
	for _, m := range models {
		current += m.Weight
		if val < current {
			return m.Name
		}
	}

	return models[0].Name
}

// selectGeminiKey rotates between available Gemini keys to balance API limits (from DB preferences or Supabase)
func (s *aiService) selectGeminiKey(prefs *domain.AppPreferences) string {
	var activeKeys []string
	if prefs.GeminiAPIKey != "" && prefs.GeminiAPIKey != "********" {
		activeKeys = append(activeKeys, prefs.GeminiAPIKey)
	}
	for _, k := range prefs.GeminiAPIKeys {
		if k != "" && k != "********" {
			activeKeys = append(activeKeys, k)
		}
	}

	// Fallback to fetch from Supabase (synced via admin console)
	if len(activeKeys) == 0 {
		if keys, err := s.settingsService.FetchGlobalAIKeys(); err == nil && len(keys) > 0 {
			for _, k := range keys {
				if k != "" && k != "********" {
					activeKeys = append(activeKeys, k)
				}
			}
		}
	}

	// Recovery from local secureconfig storage
	if len(activeKeys) == 0 {
		if key := secureconfig.GetGeminiAPIKey(); key != "" {
			activeKeys = append(activeKeys, key)
		}
	}

	if len(activeKeys) == 0 {
		return ""
	}

	// Rotate keys using request counter
	count := atomic.LoadUint64(&s.requestCounter)
	idx := int(count % uint64(len(activeKeys)))
	return activeKeys[idx]
}

// selectGroqKey retrieves the Groq API key from local preferences, Supabase settings, or env variable fallback
func (s *aiService) selectGroqKey(prefs *domain.AppPreferences) string {
	var activeKeys []string
	if prefs.GroqAPIKey != "" && prefs.GroqAPIKey != "********" {
		activeKeys = append(activeKeys, prefs.GroqAPIKey)
	}

	// Fallback to fetch from Supabase (synced via admin console)
	if len(activeKeys) == 0 {
		if keys, err := s.settingsService.FetchGlobalGroqKeys(); err == nil && len(keys) > 0 {
			for _, k := range keys {
				if k != "" && k != "********" {
					activeKeys = append(activeKeys, k)
				}
			}
		}
	}

	// Recovery from local secureconfig storage
	if len(activeKeys) == 0 {
		if key := secureconfig.GetGroqAPIKey(); key != "" {
			activeKeys = append(activeKeys, key)
		}
	}

	// Recovery from env variable (canonical GROQ_API_KEY with legacy "grok" fallback)
	if len(activeKeys) == 0 {
		envKey := os.Getenv("GROQ_API_KEY")
		if envKey == "" {
			envKey = os.Getenv("grok")
		}
		if envKey != "" {
			activeKeys = append(activeKeys, envKey)
		}
	}

	if len(activeKeys) == 0 {
		return ""
	}

	// Rotate keys using request counter
	count := atomic.LoadUint64(&s.requestCounter)
	idx := int(count % uint64(len(activeKeys)))
	return activeKeys[idx]
}
