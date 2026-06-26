package stream

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/sandbaseai/cli/internal/client"
	"github.com/sandbaseai/cli/internal/output"
)

// makeChunkData creates an OpenAI-compatible SSE data JSON string.
func makeChunkData(content string) string {
	chunk := map[string]any{
		"choices": []any{
			map[string]any{
				"delta": map[string]any{
					"content": content,
				},
			},
		},
	}
	data, _ := json.Marshal(chunk)
	return string(data)
}

func TestConsume_TTYMode(t *testing.T) {
	events := make(chan client.SSEEvent, 3)
	events <- client.SSEEvent{Data: makeChunkData("Hello")}
	events <- client.SSEEvent{Data: makeChunkData(", ")}
	events <- client.SSEEvent{Data: makeChunkData("world!")}
	close(events)

	var buf bytes.Buffer
	svc := New()
	result, err := svc.Consume(events, output.ModeTTY, &buf)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// TTY mode: content printed incrementally with trailing newline
	expected := "Hello, world!\n"
	if buf.String() != expected {
		t.Errorf("TTY output = %q, want %q", buf.String(), expected)
	}

	// Aggregated content should match (without trailing newline)
	if result.Content != "Hello, world!" {
		t.Errorf("Content = %q, want %q", result.Content, "Hello, world!")
	}

	// Raw events should be preserved
	if len(result.Raw) != 3 {
		t.Errorf("Raw events = %d, want 3", len(result.Raw))
	}
}

func TestConsume_JSONMode(t *testing.T) {
	events := make(chan client.SSEEvent, 3)
	events <- client.SSEEvent{Data: makeChunkData("Hello")}
	events <- client.SSEEvent{Data: makeChunkData(", ")}
	events <- client.SSEEvent{Data: makeChunkData("world!")}
	close(events)

	var buf bytes.Buffer
	svc := New()
	result, err := svc.Consume(events, output.ModeJSON, &buf)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// JSON mode: nothing printed during stream, complete JSON at end
	var parsed map[string]any
	if err := json.Unmarshal(buf.Bytes(), &parsed); err != nil {
		t.Fatalf("output is not valid JSON: %v\nraw output: %s", err, buf.String())
	}

	content, ok := parsed["content"].(string)
	if !ok {
		t.Fatal("JSON output missing 'content' field")
	}
	if content != "Hello, world!" {
		t.Errorf("JSON content = %q, want %q", content, "Hello, world!")
	}

	// Aggregated result matches
	if result.Content != "Hello, world!" {
		t.Errorf("Content = %q, want %q", result.Content, "Hello, world!")
	}
}

func TestConsume_SkipsDone(t *testing.T) {
	events := make(chan client.SSEEvent, 4)
	events <- client.SSEEvent{Data: makeChunkData("Hello")}
	events <- client.SSEEvent{Data: "[DONE]"}
	events <- client.SSEEvent{Data: ""}
	events <- client.SSEEvent{Data: makeChunkData(" extra")}
	close(events)

	var buf bytes.Buffer
	svc := New()
	result, err := svc.Consume(events, output.ModeTTY, &buf)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// [DONE] and empty data events should be skipped
	if result.Content != "Hello extra" {
		t.Errorf("Content = %q, want %q", result.Content, "Hello extra")
	}

	// Raw should still contain all events
	if len(result.Raw) != 4 {
		t.Errorf("Raw events = %d, want 4", len(result.Raw))
	}
}

func TestConsume_EmptyStream(t *testing.T) {
	events := make(chan client.SSEEvent)
	close(events)

	var buf bytes.Buffer
	svc := New()
	result, err := svc.Consume(events, output.ModeTTY, &buf)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Content != "" {
		t.Errorf("Content = %q, want empty", result.Content)
	}

	// No output should be written for empty stream in TTY mode
	if buf.String() != "" {
		t.Errorf("TTY output = %q, want empty", buf.String())
	}

	if len(result.Raw) != 0 {
		t.Errorf("Raw events = %d, want 0", len(result.Raw))
	}
}

func TestConsume_EmptyStream_JSONMode(t *testing.T) {
	events := make(chan client.SSEEvent)
	close(events)

	var buf bytes.Buffer
	svc := New()
	result, err := svc.Consume(events, output.ModeJSON, &buf)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Content != "" {
		t.Errorf("Content = %q, want empty", result.Content)
	}

	// JSON mode should still output valid JSON with empty content
	var parsed map[string]any
	if err := json.Unmarshal(buf.Bytes(), &parsed); err != nil {
		t.Fatalf("output is not valid JSON: %v\nraw: %s", err, buf.String())
	}
	content, ok := parsed["content"].(string)
	if !ok {
		t.Fatal("JSON output missing 'content' field")
	}
	if content != "" {
		t.Errorf("JSON content = %q, want empty", content)
	}
}

func TestExtractContentDelta(t *testing.T) {
	tests := []struct {
		name     string
		data     string
		expected string
	}{
		{
			name:     "valid OpenAI format",
			data:     makeChunkData("hello"),
			expected: "hello",
		},
		{
			name:     "empty content string",
			data:     makeChunkData(""),
			expected: "",
		},
		{
			name:     "invalid JSON",
			data:     "not json",
			expected: "",
		},
		{
			name:     "missing choices",
			data:     `{"id":"123"}`,
			expected: "",
		},
		{
			name:     "empty choices array",
			data:     `{"choices":[]}`,
			expected: "",
		},
		{
			name:     "missing delta",
			data:     `{"choices":[{"index":0}]}`,
			expected: "",
		},
		{
			name:     "missing content in delta",
			data:     `{"choices":[{"delta":{"role":"assistant"}}]}`,
			expected: "",
		},
		{
			name:     "content with special characters",
			data:     makeChunkData("Hello\nWorld\t!"),
			expected: "Hello\nWorld\t!",
		},
		{
			name:     "content with unicode",
			data:     makeChunkData("你好世界 🌍"),
			expected: "你好世界 🌍",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractContentDelta(tt.data)
			if got != tt.expected {
				t.Errorf("extractContentDelta(%q) = %q, want %q", tt.data, got, tt.expected)
			}
		})
	}
}
