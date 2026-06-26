package poller

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sandbaseai/cli/internal/client"
)

func TestBackoffDelay(t *testing.T) {
	tests := []struct {
		attempt  int
		expected time.Duration
	}{
		{0, 1000 * time.Millisecond},
		{1, 2000 * time.Millisecond},
		{2, 4000 * time.Millisecond},
		{3, 8000 * time.Millisecond},
		{4, 10000 * time.Millisecond}, // capped
		{5, 10000 * time.Millisecond}, // capped
		{6, 10000 * time.Millisecond}, // capped
	}

	for _, tt := range tests {
		got := BackoffDelay(tt.attempt)
		if got != tt.expected {
			t.Errorf("BackoffDelay(%d) = %v, want %v", tt.attempt, got, tt.expected)
		}
	}
}

func TestIsTerminal(t *testing.T) {
	tests := []struct {
		status   string
		expected bool
	}{
		{"completed", true},
		{"failed", true},
		{"queued", false},
		{"processing", false},
		{"", false},
	}

	for _, tt := range tests {
		got := IsTerminal(tt.status)
		if got != tt.expected {
			t.Errorf("IsTerminal(%q) = %v, want %v", tt.status, got, tt.expected)
		}
	}
}

func TestPoll_CompletesOnFirstTry(t *testing.T) {
	response := JobResult{
		ID:     "job-123",
		Status: "completed",
		Outputs: []OutputFile{
			{URL: "https://cdn.example.com/output.png", Type: "image"},
		},
	}

	var requestCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requestCount, 1)
		if r.URL.Path != "/v1/run/job-123" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodGet {
			t.Errorf("unexpected method: %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	apiClient := client.New(server.URL, "test-key", 30, false)
	p := New(apiClient)
	// Use zero delay for testing speed
	p.Delay = func(attempt int) time.Duration { return 0 }

	var progressCalls int
	result, err := p.Poll(context.Background(), "job-123", func(jr JobResult) {
		progressCalls++
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "completed" {
		t.Errorf("expected status completed, got %s", result.Status)
	}
	if result.ID != "job-123" {
		t.Errorf("expected ID job-123, got %s", result.ID)
	}
	if len(result.Outputs) != 1 {
		t.Errorf("expected 1 output, got %d", len(result.Outputs))
	}
	if atomic.LoadInt32(&requestCount) != 1 {
		t.Errorf("expected 1 request, got %d", requestCount)
	}
	if progressCalls != 1 {
		t.Errorf("expected 1 progress call, got %d", progressCalls)
	}
}

func TestPoll_RetriesUntilComplete(t *testing.T) {
	responses := []JobResult{
		{ID: "job-456", Status: "queued"},
		{ID: "job-456", Status: "processing"},
		{ID: "job-456", Status: "completed", Outputs: []OutputFile{{URL: "https://cdn.example.com/out.mp4", Type: "video"}}},
	}

	var requestCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		idx := int(atomic.AddInt32(&requestCount, 1)) - 1
		if idx >= len(responses) {
			t.Errorf("too many requests: %d", idx+1)
			idx = len(responses) - 1
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(responses[idx])
	}))
	defer server.Close()

	apiClient := client.New(server.URL, "test-key", 30, false)
	p := New(apiClient)
	// Use zero delay for testing speed
	p.Delay = func(attempt int) time.Duration { return 0 }

	var progressStatuses []string
	result, err := p.Poll(context.Background(), "job-456", func(jr JobResult) {
		progressStatuses = append(progressStatuses, jr.Status)
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "completed" {
		t.Errorf("expected status completed, got %s", result.Status)
	}
	if atomic.LoadInt32(&requestCount) != 3 {
		t.Errorf("expected 3 requests, got %d", requestCount)
	}
	expectedStatuses := []string{"queued", "processing", "completed"}
	if len(progressStatuses) != len(expectedStatuses) {
		t.Fatalf("expected %d progress calls, got %d", len(expectedStatuses), len(progressStatuses))
	}
	for i, s := range expectedStatuses {
		if progressStatuses[i] != s {
			t.Errorf("progress[%d] = %q, want %q", i, progressStatuses[i], s)
		}
	}
}

func TestPoll_ContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(JobResult{ID: "job-789", Status: "processing"})
	}))
	defer server.Close()

	apiClient := client.New(server.URL, "test-key", 30, false)
	p := New(apiClient)

	// Use a short delay so the test doesn't hang
	p.Delay = func(attempt int) time.Duration { return 50 * time.Millisecond }

	ctx, cancel := context.WithCancel(context.Background())

	var progressCalls int32
	go func() {
		// Cancel after the first progress callback
		for {
			if atomic.LoadInt32(&progressCalls) >= 1 {
				cancel()
				return
			}
			time.Sleep(5 * time.Millisecond)
		}
	}()

	_, err := p.Poll(ctx, "job-789", func(jr JobResult) {
		atomic.AddInt32(&progressCalls, 1)
	})

	if err == nil {
		t.Fatal("expected error from cancelled context, got nil")
	}
	if err != context.Canceled {
		t.Errorf("expected context.Canceled, got %v", err)
	}
}
