package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type geminiProvider struct{}

func (p *geminiProvider) GenerateStream(ctx context.Context, prompt string, apiKey string, model string, onChunk func(string), onError func(string)) error {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent", model)

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
	}

	// Add thinkingConfig if model is gemma-4-31b-it
	if model == "gemma-4-31b-it" {
		reqBody["generationConfig"] = map[string]interface{}{
			"thinkingConfig": map[string]interface{}{
				"thinkingLevel": "minimal",
			},
		}
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to encode request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)

	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	bufReader := bufio.NewReader(resp.Body)
	var firstByte byte
	for {
		b, err := bufReader.ReadByte()
		if err != nil {
			return fmt.Errorf("failed to read stream start: %w", err)
		}
		if b != ' ' && b != '\t' && b != '\r' && b != '\n' {
			firstByte = b
			break
		}
	}

	err = bufReader.UnreadByte()
	if err != nil {
		return fmt.Errorf("failed to unread byte: %w", err)
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
				return context.Canceled
			default:
			}

			var chunk GeminiChunk
			if err := dec.Decode(&chunk); err != nil {
				return fmt.Errorf("error decoding JSON: %w", err)
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
			return fmt.Errorf("error decoding JSON: %w", err)
		}
		if len(chunk.Candidates) > 0 && len(chunk.Candidates[0].Content.Parts) > 0 {
			textChunk := chunk.Candidates[0].Content.Parts[0].Text
			if textChunk != "" {
				onChunk(textChunk)
			}
		}
	}

	return nil
}
