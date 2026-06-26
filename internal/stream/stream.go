package stream

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/sandbaseai/cli/internal/client"
	"github.com/sandbaseai/cli/internal/output"
)

// AggregatedResult holds the result of consuming an SSE stream.
type AggregatedResult struct {
	Content string            // Full aggregated content from all chunks
	Raw     []client.SSEEvent // Original events for debugging
}

// StreamService handles SSE stream consumption in both TTY and JSON modes.
type StreamService struct{}

// New creates a StreamService.
func New() *StreamService {
	return &StreamService{}
}

// Consume reads events from the channel and either:
// - TTY mode: prints each content delta immediately to writer
// - JSON mode: aggregates all content, outputs complete JSON at the end
func (s *StreamService) Consume(events <-chan client.SSEEvent, mode output.Mode, writer io.Writer) (*AggregatedResult, error) {
	result := &AggregatedResult{}
	var contentBuilder strings.Builder

	for event := range events {
		result.Raw = append(result.Raw, event)

		// Skip non-data events or "[DONE]" markers
		if event.Data == "" || event.Data == "[DONE]" {
			continue
		}

		// Try to extract content delta from the SSE data
		// OpenAI-compatible format: {"choices":[{"delta":{"content":"..."}}]}
		delta := extractContentDelta(event.Data)
		if delta == "" {
			continue
		}

		contentBuilder.WriteString(delta)

		if mode == output.ModeTTY {
			// Stream to terminal immediately
			fmt.Fprint(writer, delta)
		}
	}

	result.Content = contentBuilder.String()

	if mode == output.ModeTTY && result.Content != "" {
		// Add trailing newline after stream completes
		fmt.Fprintln(writer)
	}

	if mode == output.ModeJSON {
		// Output complete aggregated JSON
		response := map[string]any{
			"content": result.Content,
		}
		enc := json.NewEncoder(writer)
		enc.SetIndent("", "  ")
		enc.Encode(response)
	}

	return result, nil
}

// extractContentDelta parses the SSE data JSON and extracts the content delta.
// Supports OpenAI-compatible format: {"choices":[{"delta":{"content":"text"}}]}
func extractContentDelta(data string) string {
	var parsed map[string]any
	if err := json.Unmarshal([]byte(data), &parsed); err != nil {
		return "" // Not valid JSON, skip
	}

	choices, ok := parsed["choices"].([]any)
	if !ok || len(choices) == 0 {
		return ""
	}

	choice, ok := choices[0].(map[string]any)
	if !ok {
		return ""
	}

	delta, ok := choice["delta"].(map[string]any)
	if !ok {
		return ""
	}

	content, ok := delta["content"].(string)
	if !ok {
		return ""
	}

	return content
}
