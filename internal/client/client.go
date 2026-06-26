package client

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	clierrors "github.com/sandbaseai/cli/internal/errors"
)

// SSEEvent represents a Server-Sent Event.
type SSEEvent struct {
	Event string
	Data  string
	ID    string
}

// UploadResult holds the response from a file upload.
type UploadResult struct {
	URL string `json:"url"`
}

// ApiClient handles all HTTP communication with the SandBase API.
type ApiClient struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
	Retry      *RetryPolicy
	Verbose    bool
	Stderr     io.Writer
	// TimeoutSec is the per-request timeout for unary calls (Request, PostMultipart).
	// It is applied via context.WithTimeout, NOT http.Client.Timeout, so that
	// long-lived streaming (Stream) and polling-driven downloads (GetStream) are
	// not killed by a single overall connection deadline.
	TimeoutSec int
}

// New creates a new ApiClient with the given configuration.
func New(baseURL, apiKey string, timeoutSec int, verbose bool) *ApiClient {
	return &ApiClient{
		BaseURL: strings.TrimRight(baseURL, "/"),
		APIKey:  apiKey,
		// No http.Client.Timeout: that bounds the entire request lifetime
		// including the body read, which would sever SSE streams and
		// long downloads. Per-call deadlines are applied via context instead.
		HTTPClient: &http.Client{},
		Retry:      DefaultRetryPolicy(),
		Verbose:    verbose,
		Stderr:     os.Stderr,
		TimeoutSec: timeoutSec,
	}
}

// withTimeout derives a per-request context bounded by TimeoutSec. The returned
// cancel func must be called once the request and its body read are done. When
// TimeoutSec <= 0, the parent context is returned unchanged (no deadline).
func (c *ApiClient) withTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	if c.TimeoutSec <= 0 {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, time.Duration(c.TimeoutSec)*time.Second)
}

// Request performs a JSON API request and decodes the response into result.
// A per-call timeout (TimeoutSec) is applied via context so a single unary
// call cannot hang indefinitely, while retries respect context cancellation.
func (c *ApiClient) Request(ctx context.Context, method, path string, body any, result any) error {
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	url := c.BaseURL + path

	// newReq builds a fresh request; bodyBytes is re-read on each retry.
	var bodyBytes []byte
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		bodyBytes = data
	}
	newReq := func() (*http.Request, error) {
		var br io.Reader
		if bodyBytes != nil {
			br = bytes.NewReader(bodyBytes)
		}
		req, err := http.NewRequestWithContext(ctx, method, url, br)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
		req.Header.Set("User-Agent", "sandbase-cli")
		return req, nil
	}

	req, err := newReq()
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	if c.Verbose {
		c.logRequest(req, body)
	}

	var resp *http.Response
	var attempt int
	for {
		resp, err = c.HTTPClient.Do(req)
		if err != nil {
			return c.networkError(ctx, err)
		}

		if c.Retry != nil && resp.StatusCode >= 400 {
			decision := c.Retry.Decide(resp.StatusCode, attempt)
			if decision.Retry {
				resp.Body.Close()
				attempt++
				// Respect cancellation while backing off (A2).
				select {
				case <-ctx.Done():
					return c.networkError(ctx, ctx.Err())
				case <-time.After(time.Duration(decision.DelayMs) * time.Millisecond):
				}
				req, err = newReq()
				if err != nil {
					return fmt.Errorf("create retry request: %w", err)
				}
				if c.Verbose {
					fmt.Fprintf(c.Stderr, "> (retry %d after %dms)\n", attempt, decision.DelayMs)
					c.logRequest(req, body)
				}
				continue
			}
		}
		break
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body: %w", err)
	}

	if c.Verbose {
		c.logResponse(resp, respBody)
	}

	if resp.StatusCode >= 400 {
		return c.parseError(resp.StatusCode, respBody)
	}

	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}

	return nil
}

// networkError maps a transport-level error to a CliError, distinguishing
// timeouts/cancellation from generic connectivity failures for clearer UX.
func (c *ApiClient) networkError(ctx context.Context, err error) *clierrors.CliError {
	if ctx.Err() == context.DeadlineExceeded {
		return &clierrors.CliError{
			Code:     "NETWORK_ERROR",
			Message:  fmt.Sprintf("request timed out after %ds (adjust with --timeout)", c.TimeoutSec),
			ExitCode: 1,
		}
	}
	if ctx.Err() == context.Canceled {
		return &clierrors.CliError{
			Code:     "CANCELLED",
			Message:  "request cancelled",
			ExitCode: 1,
		}
	}
	return &clierrors.CliError{
		Code:     "NETWORK_ERROR",
		Message:  fmt.Sprintf("network error: %v", err),
		ExitCode: 1,
	}
}

// Stream performs an SSE streaming request and returns a channel of events.
func (c *ApiClient) Stream(ctx context.Context, method, path string, body any) (<-chan SSEEvent, error) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	url := c.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("User-Agent", "sandbase-cli")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, c.networkError(ctx, err)
	}

	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		return nil, c.parseError(resp.StatusCode, respBody)
	}

	events := make(chan SSEEvent, 64)
	go func() {
		defer close(events)
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		// SSE data lines (large chat chunks, base64 payloads) can exceed the
		// default 64KB token limit; raise the buffer ceiling to 1MB.
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		var event SSEEvent
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				if event.Data != "" {
					select {
					case events <- event:
					case <-ctx.Done():
						return
					}
				}
				event = SSEEvent{}
				continue
			}
			// Accept both "data: x" and "data:x" per the SSE spec (the single
			// leading space after the colon is optional).
			if v, ok := sseField(line, "data"); ok {
				event.Data = v
			} else if v, ok := sseField(line, "event"); ok {
				event.Event = v
			} else if v, ok := sseField(line, "id"); ok {
				event.ID = v
			}
		}
		// Emit last event if not empty
		if event.Data != "" {
			select {
			case events <- event:
			case <-ctx.Done():
			}
		}
	}()

	return events, nil
}

// sseField parses an SSE line "field:value" or "field: value" (the space after
// the colon is optional per the spec). Returns the value and whether the field
// name matched.
func sseField(line, field string) (string, bool) {
	if !strings.HasPrefix(line, field+":") {
		return "", false
	}
	v := line[len(field)+1:]
	v = strings.TrimPrefix(v, " ")
	return v, true
}

// PostMultipart performs a multipart/form-data upload. A per-call timeout is
// applied; for very large uploads users can raise --timeout.
func (c *ApiClient) PostMultipart(ctx context.Context, path, field, filename string, r io.Reader, result any) error {
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile(field, filename)
	if err != nil {
		return fmt.Errorf("create form file: %w", err)
	}
	if _, err := io.Copy(part, r); err != nil {
		return fmt.Errorf("copy file data: %w", err)
	}
	writer.Close()

	url := c.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &buf)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("User-Agent", "sandbase-cli")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return c.networkError(ctx, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return c.parseError(resp.StatusCode, respBody)
	}

	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}

	return nil
}

// GetStream performs a GET request and returns the response body as a ReadCloser for streaming download.
func (c *ApiClient) GetStream(ctx context.Context, url string) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("User-Agent", "sandbase-cli")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, c.networkError(ctx, err)
	}

	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		return nil, c.parseError(resp.StatusCode, respBody)
	}

	return resp.Body, nil
}

// parseError implements the lenient error parser.
// Tries: error.message (object), error (string), message.
func (c *ApiClient) parseError(statusCode int, body []byte) *clierrors.CliError {
	code := statusCodeToErrorCode(statusCode)
	exitCode := 1
	msg := fmt.Sprintf("API error (status %d)", statusCode)

	var parsed map[string]any
	if json.Unmarshal(body, &parsed) == nil {
		// Try error.message (OpenAI format: {"error": {"message": "...", "type": "...", ...}})
		if errField, ok := parsed["error"]; ok {
			switch e := errField.(type) {
			case map[string]any:
				if m, ok := e["message"].(string); ok && m != "" {
					msg = m
				}
			case string:
				if e != "" {
					msg = e
				}
			}
		} else if m, ok := parsed["message"].(string); ok && m != "" {
			msg = m
		}
	}

	return &clierrors.CliError{
		Code:     code,
		Message:  msg,
		ExitCode: exitCode,
	}
}

func statusCodeToErrorCode(code int) string {
	switch code {
	case 401:
		return "AUTH_INVALID"
	case 402:
		return "INSUFFICIENT_BALANCE"
	case 400:
		return "BAD_REQUEST"
	case 429:
		return "RATE_LIMITED"
	case 502, 503:
		return "UPSTREAM_ERROR"
	default:
		return "API_ERROR"
	}
}

// logRequest logs the HTTP request in verbose mode.
func (c *ApiClient) logRequest(req *http.Request, body any) {
	fmt.Fprintf(c.Stderr, "> %s %s\n", req.Method, req.URL.String())
	for key, vals := range req.Header {
		val := strings.Join(vals, ", ")
		if key == "Authorization" {
			val = "Bearer ****"
		}
		fmt.Fprintf(c.Stderr, "> %s: %s\n", key, val)
	}
	if body != nil {
		data, _ := json.MarshalIndent(body, "> ", "  ")
		fmt.Fprintf(c.Stderr, "> Body: %s\n", string(data))
	}
	fmt.Fprintln(c.Stderr, ">")
}

// logResponse logs the HTTP response in verbose mode.
func (c *ApiClient) logResponse(resp *http.Response, body []byte) {
	fmt.Fprintf(c.Stderr, "< %d %s\n", resp.StatusCode, resp.Status)
	for key, vals := range resp.Header {
		fmt.Fprintf(c.Stderr, "< %s: %s\n", key, strings.Join(vals, ", "))
	}
	if len(body) > 0 {
		display := string(body)
		if len(display) > 2000 {
			display = display[:2000] + "... (truncated)"
		}
		fmt.Fprintf(c.Stderr, "< Body: %s\n", display)
	}
	fmt.Fprintln(c.Stderr, "<")
}
