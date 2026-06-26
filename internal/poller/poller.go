package poller

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/sandbaseai/cli/internal/client"
)

// JobPoller polls async job status until terminal state.
type JobPoller struct {
	Client *client.ApiClient
	// Delay is overridable for testing (defaults to BackoffDelay).
	Delay func(attempt int) time.Duration
}

// New creates a JobPoller with the given ApiClient.
func New(c *client.ApiClient) *JobPoller {
	return &JobPoller{
		Client: c,
		Delay:  BackoffDelay,
	}
}

// BackoffDelay calculates exponential backoff: min(1000 * 2^attempt, 10000) ms.
func BackoffDelay(attempt int) time.Duration {
	const maxDelayMs = 10000
	if attempt < 0 {
		attempt = 0
	}
	// 1000 * 2^attempt exceeds the cap once attempt >= 4 (1000*16 = 16000),
	// so clamp early. This also avoids int overflow at large attempt counts,
	// where the shift would wrap negative and bypass the cap check.
	if attempt >= 4 {
		return maxDelayMs * time.Millisecond
	}
	delay := 1000 * (1 << uint(attempt))
	if delay > maxDelayMs {
		delay = maxDelayMs
	}
	return time.Duration(delay) * time.Millisecond
}

// IsTerminal returns true if the status is a terminal state.
func IsTerminal(status string) bool {
	return status == "completed" || status == "failed"
}

// Poll polls GET /v1/run/{jobID} until terminal state or context cancellation.
func (p *JobPoller) Poll(ctx context.Context, jobID string, onProgress func(JobResult)) (*JobResult, error) {
	path := fmt.Sprintf("/v1/run/%s", jobID)
	attempt := 0

	for {
		var result JobResult
		err := p.Client.Request(ctx, http.MethodGet, path, nil, &result)
		if err != nil {
			return nil, err
		}

		if onProgress != nil {
			onProgress(result)
		}

		if IsTerminal(result.Status) {
			return &result, nil
		}

		delay := p.Delay(attempt)
		attempt++

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
	}
}
