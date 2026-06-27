package mcp

import (
	"context"
	"net/http"
)

// ChatHandler calls LLM chat completions (always synchronous).
func ChatHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		model, errResult := RequireString(params, "model")
		if errResult != nil {
			return errResult, nil
		}
		prompt, errResult := RequireString(params, "prompt")
		if errResult != nil {
			return errResult, nil
		}

		messages := []map[string]string{}
		if system := OptionalString(params, "system"); system != "" {
			messages = append(messages, map[string]string{"role": "system", "content": system})
		}
		messages = append(messages, map[string]string{"role": "user", "content": prompt})

		body := map[string]any{
			"model":    model,
			"messages": messages,
			"stream":   false,
		}

		var resp struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if err := svc.Client.Request(ctx, http.MethodPost, "/v1/chat/completions", body, &resp); err != nil {
			return ErrorResultf("chat failed: %v", err), nil
		}

		if len(resp.Choices) == 0 {
			return TextResult("(empty response)"), nil
		}
		return TextResult(resp.Choices[0].Message.Content), nil
	}
}
