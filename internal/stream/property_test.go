package stream

import (
	"bytes"
	"encoding/json"
	"math/rand"
	"strings"
	"testing"

	"github.com/sandbaseai/cli/internal/client"
	"github.com/sandbaseai/cli/internal/output"
)

// makeDeltaEvent wraps a content delta into an OpenAI-compatible SSE data frame.
func makeDeltaEvent(delta string) client.SSEEvent {
	payload := map[string]any{
		"choices": []any{
			map[string]any{
				"delta": map[string]any{"content": delta},
			},
		},
	}
	b, _ := json.Marshal(payload)
	return client.SSEEvent{Data: string(b)}
}

// feed pushes the given events through a buffered channel, then closes it.
func feed(events []client.SSEEvent) <-chan client.SSEEvent {
	ch := make(chan client.SSEEvent, len(events)+1)
	for _, e := range events {
		ch <- e
	}
	close(ch)
	return ch
}

var deltaWords = []string{"Hello", " ", "world", "!", "foo", "bar", "\n", "123", "你好", "", "a"}

// Feature: sandbase-cli, Property 19: SSE 流式聚合 — For any sequence of content delta chunks, JSON-mode aggregation equals the in-order concatenation of deltas, independent of chunk boundaries.
func TestProperty19_StreamAggregation(t *testing.T) {
	rng := rand.New(rand.NewSource(19))
	svc := New()

	for iter := 0; iter < 200; iter++ {
		// Build a random sequence of content deltas.
		n := rng.Intn(12) // 0..11 chunks
		deltas := make([]string, n)
		var expected strings.Builder
		for i := range deltas {
			d := deltaWords[rng.Intn(len(deltaWords))]
			deltas[i] = d
			expected.WriteString(d)
		}

		// Convert deltas to SSE events; optionally interleave noise events
		// (empty data / [DONE] markers) that must not affect aggregation.
		events := make([]client.SSEEvent, 0, len(deltas)+3)
		for _, d := range deltas {
			events = append(events, makeDeltaEvent(d))
			if rng.Intn(4) == 0 {
				events = append(events, client.SSEEvent{Data: ""})
			}
		}
		if rng.Intn(2) == 0 {
			events = append(events, client.SSEEvent{Data: "[DONE]"})
		}

		var buf bytes.Buffer
		result, err := svc.Consume(feed(events), output.ModeJSON, &buf)
		if err != nil {
			t.Fatalf("Property 19 failed: Consume error: %v", err)
		}

		// Aggregated content must equal in-order concatenation of deltas.
		if result.Content != expected.String() {
			t.Fatalf("Property 19 failed: aggregated %q want %q", result.Content, expected.String())
		}

		// JSON-mode output must be parseable and carry the same content.
		if buf.Len() > 0 {
			var out map[string]any
			if err := json.Unmarshal(buf.Bytes(), &out); err != nil {
				t.Fatalf("Property 19 failed: JSON output not parseable: %v\n%s", err, buf.String())
			}
			if c, ok := out["content"].(string); !ok || c != expected.String() {
				t.Fatalf("Property 19 failed: JSON content %v want %q", out["content"], expected.String())
			}
		}

		// Independence from chunk boundaries: re-chunk the SAME concatenated
		// content into different deltas and confirm identical aggregation.
		full := expected.String()
		reEvents := reChunk(rng, full)
		var buf2 bytes.Buffer
		result2, err := svc.Consume(feed(reEvents), output.ModeJSON, &buf2)
		if err != nil {
			t.Fatalf("Property 19 failed: Consume(re-chunk) error: %v", err)
		}
		if result2.Content != full {
			t.Fatalf("Property 19 failed: re-chunked aggregation %q want %q", result2.Content, full)
		}
	}
}

// reChunk splits a string into a random set of contiguous pieces and wraps each
// as a delta SSE event. Concatenation of the pieces equals the original string.
func reChunk(rng *rand.Rand, s string) []client.SSEEvent {
	runes := []rune(s)
	var events []client.SSEEvent
	i := 0
	for i < len(runes) {
		step := 1 + rng.Intn(3)
		if i+step > len(runes) {
			step = len(runes) - i
		}
		events = append(events, makeDeltaEvent(string(runes[i:i+step])))
		i += step
	}
	return events
}
