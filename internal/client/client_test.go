package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	clierrors "github.com/sandbaseai/cli/internal/errors"
)

func newTestClient(serverURL string) *ApiClient {
	return &ApiClient{
		BaseURL:    serverURL,
		APIKey:     "sk-sb-test-key",
		HTTPClient: http.DefaultClient,
		Retry:      nil, // No retries in tests unless explicitly set
		Verbose:    false,
		Stderr:     io.Discard,
	}
}

func TestRequest_Success(t *testing.T) {
	type responsePayload struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request properties
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/v1/test" {
			t.Errorf("expected /v1/test, got %s", r.URL.Path)
		}
		if auth := r.Header.Get("Authorization"); auth != "Bearer sk-sb-test-key" {
			t.Errorf("expected Bearer token, got %s", auth)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("expected application/json content-type, got %s", ct)
		}

		// Verify request body
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["prompt"] != "hello" {
			t.Errorf("expected prompt=hello, got %v", body["prompt"])
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		json.NewEncoder(w).Encode(responsePayload{ID: "123", Name: "test"})
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	var result responsePayload
	err := client.Request(context.Background(), http.MethodPost, "/v1/test", map[string]any{"prompt": "hello"}, &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID != "123" || result.Name != "test" {
		t.Errorf("unexpected result: %+v", result)
	}
}

func TestRequest_ErrorParsing_ObjectError(t *testing.T) {
	// OpenAI-style error: {"error": {"message": "...", "type": "..."}}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		fmt.Fprint(w, `{"error": {"message": "invalid model slug", "type": "invalid_request_error"}}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	err := client.Request(context.Background(), http.MethodPost, "/v1/run", nil, nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var cliErr *clierrors.CliError
	if !errors.As(err, &cliErr) {
		t.Fatalf("expected CliError, got %T: %v", err, err)
	}
	if cliErr.Code != "BAD_REQUEST" {
		t.Errorf("expected code BAD_REQUEST, got %s", cliErr.Code)
	}
	if cliErr.Message != "invalid model slug" {
		t.Errorf("expected message 'invalid model slug', got '%s'", cliErr.Message)
	}
	if cliErr.ExitCode != 1 {
		t.Errorf("expected exit code 1, got %d", cliErr.ExitCode)
	}
}

func TestRequest_ErrorParsing_StringError(t *testing.T) {
	// String error: {"error": "some string"}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		fmt.Fprint(w, `{"error": "something went wrong"}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	err := client.Request(context.Background(), http.MethodGet, "/v1/models", nil, nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var cliErr *clierrors.CliError
	if !errors.As(err, &cliErr) {
		t.Fatalf("expected CliError, got %T: %v", err, err)
	}
	if cliErr.Message != "something went wrong" {
		t.Errorf("expected message 'something went wrong', got '%s'", cliErr.Message)
	}
}

func TestRequest_ErrorParsing_MessageField(t *testing.T) {
	// Fallback: {"message": "not found"}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(404)
		fmt.Fprint(w, `{"message": "resource not found"}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	err := client.Request(context.Background(), http.MethodGet, "/v1/agents/abc", nil, nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var cliErr *clierrors.CliError
	if !errors.As(err, &cliErr) {
		t.Fatalf("expected CliError, got %T: %v", err, err)
	}
	if cliErr.Message != "resource not found" {
		t.Errorf("expected message 'resource not found', got '%s'", cliErr.Message)
	}
}

func TestRequest_NetworkError(t *testing.T) {
	// Use a URL that's guaranteed to be unreachable
	client := newTestClient("http://127.0.0.1:1")
	err := client.Request(context.Background(), http.MethodGet, "/v1/test", nil, nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var cliErr *clierrors.CliError
	if !errors.As(err, &cliErr) {
		t.Fatalf("expected CliError, got %T: %v", err, err)
	}
	if cliErr.Code != "NETWORK_ERROR" {
		t.Errorf("expected code NETWORK_ERROR, got %s", cliErr.Code)
	}
}

func TestRequest_VerboseMode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		fmt.Fprint(w, `{"ok": true}`)
	}))
	defer server.Close()

	var stderr bytes.Buffer
	client := newTestClient(server.URL)
	client.Verbose = true
	client.Stderr = &stderr

	err := client.Request(context.Background(), http.MethodGet, "/v1/test", nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	output := stderr.String()
	// Should log request
	if !strings.Contains(output, "> GET") {
		t.Error("verbose output should contain request method")
	}
	// Should mask the API key
	if strings.Contains(output, "sk-sb-test-key") {
		t.Error("verbose output should NOT contain the actual API key")
	}
	if !strings.Contains(output, "Bearer ****") {
		t.Error("verbose output should contain masked Bearer token")
	}
	// Should log response
	if !strings.Contains(output, "< 200") {
		t.Error("verbose output should contain response status")
	}
}

func TestStream_ParsesEvents(t *testing.T) {
	ssePayload := "event: message\ndata: hello world\nid: 1\n\nevent: message\ndata: second chunk\nid: 2\n\n"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Accept") != "text/event-stream" {
			t.Errorf("expected Accept: text/event-stream, got %s", r.Header.Get("Accept"))
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(200)
		w.Write([]byte(ssePayload))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	events, err := client.Stream(context.Background(), http.MethodPost, "/v1/chat/completions", map[string]any{"model": "test"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var received []SSEEvent
	for ev := range events {
		received = append(received, ev)
	}

	if len(received) != 2 {
		t.Fatalf("expected 2 events, got %d", len(received))
	}
	if received[0].Event != "message" || received[0].Data != "hello world" || received[0].ID != "1" {
		t.Errorf("unexpected first event: %+v", received[0])
	}
	if received[1].Event != "message" || received[1].Data != "second chunk" || received[1].ID != "2" {
		t.Errorf("unexpected second event: %+v", received[1])
	}
}

func TestStream_ErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		fmt.Fprint(w, `{"error": {"message": "invalid api key"}}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	_, err := client.Stream(context.Background(), http.MethodPost, "/v1/chat/completions", nil)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var cliErr *clierrors.CliError
	if !errors.As(err, &cliErr) {
		t.Fatalf("expected CliError, got %T: %v", err, err)
	}
	if cliErr.Code != "AUTH_INVALID" {
		t.Errorf("expected AUTH_INVALID, got %s", cliErr.Code)
	}
}

func TestPostMultipart_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
			t.Errorf("expected multipart content-type, got %s", r.Header.Get("Content-Type"))
		}
		if r.Header.Get("Authorization") != "Bearer sk-sb-test-key" {
			t.Errorf("expected Bearer token, got %s", r.Header.Get("Authorization"))
		}

		// Parse multipart
		err := r.ParseMultipartForm(10 << 20)
		if err != nil {
			t.Fatalf("failed to parse multipart: %v", err)
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			t.Fatalf("failed to get form file: %v", err)
		}
		defer file.Close()
		if header.Filename != "test.png" {
			t.Errorf("expected filename test.png, got %s", header.Filename)
		}

		w.WriteHeader(200)
		fmt.Fprint(w, `{"url": "https://cdn.sandbase.ai/uploads/abc123.png"}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	var result UploadResult
	fileData := strings.NewReader("fake image data")
	err := client.PostMultipart(context.Background(), "/v1/upload", "file", "test.png", fileData, &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.URL != "https://cdn.sandbase.ai/uploads/abc123.png" {
		t.Errorf("unexpected URL: %s", result.URL)
	}
}

func TestGetStream_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}
		w.WriteHeader(200)
		w.Write([]byte("binary file content"))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	body, err := client.GetStream(context.Background(), server.URL+"/files/abc.png")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer body.Close()

	data, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("failed to read body: %v", err)
	}
	if string(data) != "binary file content" {
		t.Errorf("unexpected body: %s", string(data))
	}
}

func TestGetStream_ErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
		fmt.Fprint(w, `{"message": "file not found"}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	_, err := client.GetStream(context.Background(), server.URL+"/files/missing.png")
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var cliErr *clierrors.CliError
	if !errors.As(err, &cliErr) {
		t.Fatalf("expected CliError, got %T: %v", err, err)
	}
	if cliErr.Message != "file not found" {
		t.Errorf("expected 'file not found', got '%s'", cliErr.Message)
	}
}

func TestStatusCodeToErrorCode(t *testing.T) {
	cases := []struct {
		code     int
		expected string
	}{
		{401, "AUTH_INVALID"},
		{402, "INSUFFICIENT_BALANCE"},
		{400, "BAD_REQUEST"},
		{429, "RATE_LIMITED"},
		{502, "UPSTREAM_ERROR"},
		{503, "UPSTREAM_ERROR"},
		{500, "API_ERROR"},
	}
	for _, tc := range cases {
		t.Run(fmt.Sprintf("status_%d", tc.code), func(t *testing.T) {
			got := statusCodeToErrorCode(tc.code)
			if got != tc.expected {
				t.Errorf("statusCodeToErrorCode(%d) = %s, want %s", tc.code, got, tc.expected)
			}
		})
	}
}

func TestStream_ParsesNoSpaceDataField(t *testing.T) {
	// SSE chunks using "data:{json}" with NO space after the colon. The
	// sseField helper treats the leading space as optional, so these must
	// still parse.
	ssePayload := `data:{"choices":[{"delta":{"content":"hi"}}]}` + "\n\n" +
		`data:{"choices":[{"delta":{"content":"there"}}]}` + "\n\n"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(200)
		w.Write([]byte(ssePayload))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	events, err := client.Stream(context.Background(), http.MethodPost, "/v1/chat/completions", map[string]any{"model": "test"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var received []SSEEvent
	for ev := range events {
		received = append(received, ev)
	}

	if len(received) != 2 {
		t.Fatalf("expected 2 events, got %d", len(received))
	}
	if received[0].Data != `{"choices":[{"delta":{"content":"hi"}}]}` {
		t.Errorf("unexpected first event data: %q", received[0].Data)
	}
	if received[1].Data != `{"choices":[{"delta":{"content":"there"}}]}` {
		t.Errorf("unexpected second event data: %q", received[1].Data)
	}
}

func TestStream_LargeDataLine(t *testing.T) {
	// A single SSE data line larger than the default 64KB scanner token limit
	// must parse without truncation (the buffer ceiling was raised to 1MB).
	const contentSize = 100 * 1024 // 100KB
	bigContent := strings.Repeat("a", contentSize)

	// Wrap as a single-line JSON SSE data payload.
	payload, err := json.Marshal(map[string]any{
		"choices": []any{
			map[string]any{"delta": map[string]any{"content": bigContent}},
		},
	})
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}
	dataLine := string(payload)
	if len(dataLine) <= 64*1024 {
		t.Fatalf("test setup error: data line %d bytes is not larger than 64KB", len(dataLine))
	}
	ssePayload := "data: " + dataLine + "\n\n"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(200)
		w.Write([]byte(ssePayload))
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	events, err := client.Stream(context.Background(), http.MethodPost, "/v1/chat/completions", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var received []SSEEvent
	for ev := range events {
		received = append(received, ev)
	}

	if len(received) != 1 {
		t.Fatalf("expected 1 event, got %d", len(received))
	}
	if len(received[0].Data) != len(dataLine) {
		t.Errorf("data was truncated: got %d bytes, want %d bytes", len(received[0].Data), len(dataLine))
	}
	if received[0].Data != dataLine {
		t.Error("received data does not match sent data")
	}
}

func TestRequest_RetryRespectsContextCancellation(t *testing.T) {
	// A server that always returns 429. The default retry policy would back
	// off for 1s before the first retry; cancelling the context shortly after
	// the call starts must abort the backoff promptly rather than blocking for
	// the full delay.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(429)
		fmt.Fprint(w, `{"error": {"message": "rate limited"}}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	client.Retry = DefaultRetryPolicy() // 429 -> retry with 1s backoff

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	err := client.Request(ctx, http.MethodPost, "/v1/run", map[string]any{"prompt": "hi"}, nil)
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if elapsed > 800*time.Millisecond {
		t.Errorf("Request blocked for %v; expected to abort backoff promptly after cancellation", elapsed)
	}

	var cliErr *clierrors.CliError
	if !errors.As(err, &cliErr) {
		t.Fatalf("expected CliError, got %T: %v", err, err)
	}
	if cliErr.Code != "CANCELLED" && cliErr.Code != "NETWORK_ERROR" {
		t.Errorf("expected CANCELLED or NETWORK_ERROR, got %s", cliErr.Code)
	}
}

func TestWithTimeout(t *testing.T) {
	// TimeoutSec <= 0: parent context is returned unchanged (no deadline) and
	// the cancel func is a safe no-op.
	t.Run("no_timeout", func(t *testing.T) {
		c := &ApiClient{TimeoutSec: 0}
		parent := context.Background()
		ctx, cancel := c.withTimeout(parent)
		defer cancel()
		if _, ok := ctx.Deadline(); ok {
			t.Error("expected no deadline when TimeoutSec <= 0")
		}
		cancel() // must not panic / must be a no-op
		if ctx.Err() != nil {
			t.Errorf("parent context should be unaffected by no-op cancel, got %v", ctx.Err())
		}
	})

	// TimeoutSec > 0: returned context carries a deadline roughly TimeoutSec
	// seconds out, and cancel cancels it.
	t.Run("with_timeout", func(t *testing.T) {
		c := &ApiClient{TimeoutSec: 5}
		ctx, cancel := c.withTimeout(context.Background())
		defer cancel()
		deadline, ok := ctx.Deadline()
		if !ok {
			t.Fatal("expected a deadline when TimeoutSec > 0")
		}
		remaining := time.Until(deadline)
		if remaining <= 0 || remaining > 5*time.Second {
			t.Errorf("unexpected deadline: %v remaining", remaining)
		}
		cancel()
		if ctx.Err() != context.Canceled {
			t.Errorf("expected context.Canceled after cancel, got %v", ctx.Err())
		}
	})
}
