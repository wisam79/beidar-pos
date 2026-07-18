package service

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestGeminiProviderGenerateStream(t *testing.T) {
	provider := &geminiProvider{}
	ctx, cancel := context.WithCancel(context.Background())
	
	// Test cancellation handling
	cancel() // cancel immediately
	err := provider.GenerateStream(ctx, "hello", "test-key", "gemma-4-31b-it", func(string) {}, func(string) {})
	if !errors.Is(err, context.Canceled) {
		t.Errorf("Expected context canceled error, got %v", err)
	}

	// For a real test, we would mock the external HTTP call.
	// We can test basic error returned when API key is invalid (which will fail immediately via the API).
	// We will use a fast timeout for this test so it doesn't hang.
	ctx2, cancel2 := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel2()
	
	err = provider.GenerateStream(ctx2, "hello", "invalid-key", "gemma-4-31b-it", func(string) {}, func(string) {})
	if err == nil {
		t.Errorf("Expected an error due to invalid API key")
	}
}
