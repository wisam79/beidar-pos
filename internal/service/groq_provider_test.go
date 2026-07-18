package service

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestGroqProviderGenerateStream(t *testing.T) {
	provider := &groqProvider{}
	ctx, cancel := context.WithCancel(context.Background())
	
	// Test cancellation handling
	cancel() // cancel immediately
	err := provider.GenerateStream(ctx, "hello", "test-key", "llama3", func(string) {}, func(string) {})
	if !errors.Is(err, context.Canceled) {
		t.Errorf("Expected context canceled error, got %v", err)
	}

	// Test with invalid key, expecting immediate failure
	ctx2, cancel2 := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel2()
	
	err = provider.GenerateStream(ctx2, "hello", "invalid-key", "llama3", func(string) {}, func(string) {})
	if err == nil {
		t.Errorf("Expected an error due to invalid API key")
	}
}
