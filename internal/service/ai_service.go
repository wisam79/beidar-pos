package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"beidar-desktop/internal/core/domain"
)

type aiService struct {
	settingsService domain.SettingsService
	aiMutex         sync.Mutex
	aiCancelMu      sync.Mutex
	aiCancel        context.CancelFunc
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

	apiKey := prefs.GeminiAPIKey
	if apiKey == "" && len(prefs.GeminiAPIKeys) > 0 {
		apiKey = prefs.GeminiAPIKeys[0]
	}

	if apiKey == "" {
		apiKey = os.Getenv("GEMINI_API_KEY")
	}

	if apiKey == "" {
		s.aiMutex.Unlock()
		return fmt.Errorf("يرجى إدخال مفتاح Gemini API في الإعدادات أولاً")
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.aiCancelMu.Lock()
	s.aiCancel = cancel
	s.aiCancelMu.Unlock()

	go func() {
		defer func() {
			s.aiMutex.Unlock()
			if r := recover(); r != nil {
				onError(fmt.Sprintf("Panic: %v", r))
			}
		}()

		select {
		case <-ctx.Done():
			onComplete()
			return
		default:
		}

		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=%s", apiKey)

		reqBody := map[string]interface{}{
			"contents": []map[string]interface{}{
				{
					"parts": []map[string]interface{}{
						{"text": prompt},
					},
				},
			},
		}

		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			onError("فشل في تشفير طلب الذكاء الاصطناعي: " + err.Error())
			return
		}

		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
		if err != nil {
			onError("فشل في إنشاء طلب HTTP: " + err.Error())
			return
		}
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{
			Timeout: 60 * time.Second,
		}

		resp, err := client.Do(req)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				onComplete()
				return
			}
			onError("فشل الاتصال بخدمة الذكاء الاصطناعي: " + err.Error())
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			onError(fmt.Sprintf("خطأ من خادم Gemini (Status %d): %s", resp.StatusCode, string(bodyBytes)))
			return
		}

		bufReader := bufio.NewReader(resp.Body)
		var firstByte byte
		for {
			b, err := bufReader.ReadByte()
			if err != nil {
				onError("فشل قراءة الاستجابة: " + err.Error())
				return
			}
			if b != ' ' && b != '\t' && b != '\r' && b != '\n' {
				firstByte = b
				break
			}
		}

		err = bufReader.UnreadByte()
		if err != nil {
			onError("فشل تهيئة القارئ: " + err.Error())
			return
		}

		dec := json.NewDecoder(bufReader)

		type GeminiChunk struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}

		if firstByte == '[' {
			_, _ = dec.Token()
			for dec.More() {
				select {
				case <-ctx.Done():
					onComplete()
					return
				default:
				}

				var chunk GeminiChunk
				if err := dec.Decode(&chunk); err != nil {
					onError("خطأ أثناء تحليل النص: " + err.Error())
					return
				}
				if len(chunk.Candidates) > 0 && len(chunk.Candidates[0].Content.Parts) > 0 {
					textChunk := chunk.Candidates[0].Content.Parts[0].Text
					if textChunk != "" {
						onChunk(textChunk)
					}
				}
			}
			_, _ = dec.Token()
		} else {
			var chunk GeminiChunk
			if err := dec.Decode(&chunk); err != nil {
				onError("خطأ أثناء تحليل النص: " + err.Error())
				return
			}
			if len(chunk.Candidates) > 0 && len(chunk.Candidates[0].Content.Parts) > 0 {
				textChunk := chunk.Candidates[0].Content.Parts[0].Text
				if textChunk != "" {
					onChunk(textChunk)
				}
			}
		}

		onComplete()
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
