package handlers

import (
	"context"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// AIHandler exposes AI operations to the frontend via Wails
type AIHandler struct {
	ctx       context.Context
	aiService domain.AIService
}

// NewAIHandler creates a new instance of AIHandler
func NewAIHandler(aiService domain.AIService) *AIHandler {
	return &AIHandler{
		aiService: aiService,
	}
}

// Startup is called when Wails starts up
func (h *AIHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

// AI_GenerateStream streams generation response from Gemini API
func (h *AIHandler) AI_GenerateStream(prompt string) error {
	if err := auth.Require(); err != nil {
		return err
	}
	return h.aiService.GenerateStream(
		prompt,
		func(chunk string) {
			runtime.EventsEmit(h.ctx, "ai-stream-chunk", chunk)
		},
		func(errStr string) {
			runtime.EventsEmit(h.ctx, "ai-stream-error", errStr)
		},
		func() {
			runtime.EventsEmit(h.ctx, "ai-stream-complete", "")
		},
	)
}

// AI_CancelStream cancels the current AI generation stream
func (h *AIHandler) AI_CancelStream() {
	h.aiService.CancelStream()
}
